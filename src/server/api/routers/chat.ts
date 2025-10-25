import { z } from "zod";
import OpenAI from "openai";

import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Initialize once per server process
const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const chatRouter = createTRPCRouter({
  /**
   * Send a user message to the AI model via OpenRouter using the OpenAI SDK.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message cannot be empty").max(4000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const referer =
        (ctx.headers instanceof Headers ? ctx.headers.get("origin") : null) ||
        (ctx.headers instanceof Headers ? ctx.headers.get("referer") : null) ||
        undefined;

      const completion = await openai.chat.completions.create(
        {
          model: "openai/gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are Planwise, a friendly assistant that helps users plan events, budgets, and tasks. Keep replies concise and helpful. Your objective is to determine user's event is about and provide tailored suggestions.",
            },
            { role: "user", content: input.message },
          ],
        },
        {
          headers: {
            "HTTP-Referer": referer ?? "http://localhost:3000",
            "X-Title": "Planwise",
          },
        },
      );

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ??
        "Sorry, I couldn’t generate a response.";

      return {
        reply,
        at: new Date(),
      };
    }),
});

export type ChatRouter = typeof chatRouter;
