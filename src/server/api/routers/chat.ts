import {
  Prisma,
  type PrismaClient,
  type EventPlan,
  type BudgetItem,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import OpenAI from "openai";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { searchPricing } from "~/server/services/pricing-scraper";

const HISTORY_LIMIT = 20;
const PRICING_TRIGGER_KEYWORDS = [
  "price",
  "budget",
  "cost",
  "estimate",
  "quotes",
];

const sendMessageInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(4000),
  conversationId: z.string().cuid().optional(),
  event: z
    .object({
      name: z.string().min(1).max(120).optional(),
      location: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional(),
      totalBudget: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      plannedDate: z.coerce.date().optional(),
    })
    .optional(),
});

type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

type SendMessageCtx = {
  db: PrismaClient;
  session: { user: { id: string } };
  headers: Headers;
};

// Initialize once per server process
const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const chatRouter = createTRPCRouter({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const conversations = await ctx.db.conversation.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        eventPlans: {
          select: {
            id: true,
            name: true,
            totalBudget: true,
            currency: true,
            status: true,
          },
        },
      },
    });

    return conversations.map(({ eventPlans, ...rest }) => ({
      ...rest,
      eventPlan: eventPlans[0] ?? null,
    }));
  }),

  getConversation: protectedProcedure
    .input(
      z.object({ conversationId: z.string().cuid("Invalid conversation id") }),
    )
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.db.conversation.findFirst({
        where: {
          id: input.conversationId,
          userId: ctx.session.user.id,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
          eventPlans: {
            include: {
              items: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      return {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          summary: conversation.summary,
          messages: conversation.messages,
        },
        eventPlan: conversation.eventPlans[0] ?? null,
      };
    }),

  sendMessage: protectedProcedure
    .input(sendMessageInputSchema)
    .mutation(async ({ input, ctx }) => {
      const referer =
        (ctx.headers instanceof Headers ? ctx.headers.get("origin") : null) ||
        (ctx.headers instanceof Headers ? ctx.headers.get("referer") : null) ||
        undefined;

      const { conversation, eventPlan } = await resolveConversation(ctx, input);

      // Persist user message
      await ctx.db.message.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: input.message,
        },
      });

      const planWithItems = await ctx.db.eventPlan.findUnique({
        where: { id: eventPlan.id },
        include: { items: true },
      });

      const recentMessages = await ctx.db.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: HISTORY_LIMIT,
      });

      const pricingContext = await maybeFetchPricing(eventPlan, input.message);

      if (planWithItems && pricingContext && pricingContext.itemsToPersist.length > 0) {
        await upsertBudgetItems(ctx, planWithItems.id, pricingContext.itemsToPersist);
      }

  const planSummaryText = buildPlanSummary(planWithItems);
      const pricingSummaryText = pricingContext?.results
        .map((result) =>
          `${result.title}${result.priceText ? ` – ${result.priceText}` : ""}${result.sourceUrl ? ` (${result.sourceUrl})` : ""}`,
        )
        .join("\n");

      const systemContent =
        "You are Planwise, a collaborative event planning assistant. " +
        "Always consider the existing plan, budget, and past actions when responding. " +
        "If you add or adjust items, mention the updated totals. " +
        "When you suggest venues or services, include price estimates when available.\n\n" +
        `Current Plan Summary:\n${planSummaryText || "No plan details yet."}` +
        (pricingSummaryText
          ? `\n\nRecent Pricing Suggestions:\n${pricingSummaryText}`
          : "");

      const completion = await openai.chat.completions.create(
        {
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemContent },
            ...recentMessages.map((message) => ({
              role: mapRoleToOpenAI(message.role),
              content: message.content,
            })),
          ],
        },
        {
          headers: {
            "HTTP-Referer": referer ?? "http://localhost:3000",
            "X-Title": "Planwise",
          },
        },
      );

      const assistantReply =
        completion.choices?.[0]?.message?.content?.trim() ??
        "Sorry, I couldn’t generate a response.";

      const assistantMessage = await ctx.db.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: assistantReply,
        },
      });

      const refreshedPlan = await ctx.db.eventPlan.findUnique({
        where: { id: eventPlan.id },
        include: { items: true },
      });

      const updatedSummary = buildPlanSummary(refreshedPlan);
      await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: {
          summary: updatedSummary,
          title: conversation.title || deriveConversationTitle(input),
        },
      });

      return {
        reply: assistantMessage.content,
        at: assistantMessage.createdAt,
        conversationId: conversation.id,
        eventPlan: refreshedPlan,
        pricing: pricingContext?.results ?? [],
      };
    }),
});

async function resolveConversation(ctx: SendMessageCtx, input: SendMessageInput) {
  const { conversationId, event } = input;

  if (conversationId) {
    const existing = await ctx.db.conversation.findFirst({
      where: {
        id: conversationId,
        userId: ctx.session.user.id,
      },
      include: { eventPlans: true },
    });

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found or access denied",
      });
    }

    const plan = await ensurePlanForConversation(ctx, existing.id, event);
    return { conversation: existing, eventPlan: plan };
  }

  const title = deriveConversationTitle(input);

  const newConversation = await ctx.db.conversation.create({
    data: {
      userId: ctx.session.user.id,
      title,
    },
    include: { eventPlans: true },
  });

  const newPlan = await ensurePlanForConversation(ctx, newConversation.id, event);

  return { conversation: newConversation, eventPlan: newPlan };
}

async function ensurePlanForConversation(
  ctx: SendMessageCtx,
  conversationId: string,
  eventDetails?: SendMessageInput["event"],
) {
  const existingPlan = await ctx.db.eventPlan.findFirst({
    where: { conversationId },
  });

  if (existingPlan) {
    if (eventDetails) {
      await ctx.db.eventPlan.update({
        where: { id: existingPlan.id },
        data: {
          name: eventDetails.name ?? existingPlan.name,
          description: eventDetails.description ?? existingPlan.description,
          location: eventDetails.location ?? existingPlan.location,
          totalBudget: eventDetails.totalBudget ?? existingPlan.totalBudget,
          currency: eventDetails.currency ?? existingPlan.currency,
          plannedDate: eventDetails.plannedDate ?? existingPlan.plannedDate,
        },
      });
    }

    return ctx.db.eventPlan.findUniqueOrThrow({
      where: { id: existingPlan.id },
    });
  }

  const createdPlan = await ctx.db.eventPlan.create({
    data: {
      conversationId,
      name:
        eventDetails?.name ??
        "Untitled Event",
      description: eventDetails?.description,
      location: eventDetails?.location,
      totalBudget: eventDetails?.totalBudget,
      currency: eventDetails?.currency ?? "USD",
      plannedDate: eventDetails?.plannedDate,
    },
  });

  return createdPlan;
}

function deriveConversationTitle(input: { message: string; event?: { name?: string } }) {
  if (input.event?.name) return input.event.name;
  const base = input.message.trim().slice(0, 40);
  return base ? `${base}${base.length === 40 ? "…" : ""}` : "New Event Plan";
}

function mapRoleToOpenAI(
  role: Prisma.MessageRole,
): "user" | "assistant" | "system" | "tool" {
  switch (role) {
    case "USER":
      return "user";
    case "ASSISTANT":
      return "assistant";
    case "SYSTEM":
      return "system";
    case "TOOL":
      return "tool";
    default:
      return "user";
  }
}

function buildPlanSummary(plan: (EventPlan & { items?: BudgetItem[] }) | null | undefined) {
  if (!plan) return "No event plan captured yet.";

  const lines = [
    `Name: ${plan.name}`,
    plan.description ? `Description: ${plan.description}` : null,
    plan.location ? `Location: ${plan.location}` : null,
    plan.totalBudget
      ? `Budget: ${plan.currency ?? "USD"} ${formatDecimal(plan.totalBudget)}`
      : null,
  ].filter(Boolean);

  if (plan.items?.length) {
    const items = plan.items
      .slice(0, 8)
      .map((item) =>
        `• ${item.title}${
          item.estimatedCost
            ? ` - ${item.currency ?? "USD"} ${formatDecimal(item.estimatedCost)}`
            : ""
        }${item.isConfirmed ? " (confirmed)" : ""}`,
      );
    lines.push("Budget Items:\n" + items.join("\n"));
  }

  return lines.join("\n");
}

async function maybeFetchPricing(
  plan: EventPlan | null | undefined,
  message: string,
) {
  if (!plan) return null;

  const lower = message.toLowerCase();
  const shouldFetch = PRICING_TRIGGER_KEYWORDS.some((keyword) =>
    lower.includes(keyword),
  );

  if (!shouldFetch) return null;

  const queryParts = [plan.name, plan.location, message]
    .filter(Boolean)
    .join(" ");

  if (!queryParts) return null;

  const pricing = await searchPricing({
    query: queryParts,
    location: plan.location ?? undefined,
    currency: plan.currency ?? undefined,
  });

  const itemsToPersist = pricing.results.map((result) => ({
    title: result.title,
    category: undefined,
    estimatedCost: result.priceValue,
    currency: result.currency ?? plan.currency ?? "USD",
    quantity: 1,
    unit: undefined,
    sourceUrl: result.sourceUrl,
    sourceName: result.source,
    notes: result.priceText,
    isConfirmed: false,
  }));

  return {
    results: pricing.results,
    itemsToPersist,
  };
}

async function upsertBudgetItems(
  ctx: SendMessageCtx,
  eventPlanId: string,
  items: Array<{
    title: string;
    category?: string;
    estimatedCost?: number;
    currency: string;
    quantity: number;
    unit?: string;
    sourceUrl?: string;
    sourceName?: string;
    notes?: string;
    isConfirmed: boolean;
  }>,
) {
  for (const item of items) {
    const existing = await ctx.db.budgetItem.findFirst({
      where: {
        eventPlanId,
        title: item.title,
        sourceUrl: item.sourceUrl,
      },
    });

    if (existing) {
      await ctx.db.budgetItem.update({
        where: { id: existing.id },
        data: {
          estimatedCost: item.estimatedCost ?? existing.estimatedCost,
          currency: item.currency,
          notes: item.notes ?? existing.notes,
          sourceName: item.sourceName ?? existing.sourceName,
        },
      });
    } else {
      await ctx.db.budgetItem.create({
        data: {
          eventPlanId,
          ...item,
        },
      });
    }
  }
}

function formatDecimal(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return "0.00";
  if (typeof value === "number") return value.toFixed(2);
  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber().toFixed(2);
  }
  if (typeof (value as { toString?: () => string }).toString === "function") {
    const parsed = Number((value as { toString: () => string }).toString());
    if (!Number.isNaN(parsed)) return parsed.toFixed(2);
  }
  return "0.00";
}

export type ChatRouter = typeof chatRouter;
