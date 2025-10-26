"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { api, type RouterOutputs } from "~/trpc/react";
type PricingHighlight = RouterOutputs["chat"]["sendMessage"]["pricing"][number];

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

const MAX_CONVERSATION_TITLE = 32;
const ASSISTANT_MARKDOWN_CLASSES =
  "prose prose-slate prose-sm max-w-none text-gray-900 [&>*]:break-words [&>p]:leading-relaxed [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>hr]:border-gray-200 [&>hr]:my-4 [&>strong]:text-gray-900 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-2 [&>h2]:mb-1";

const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
};

export default function ChatClient() {
  const [input, setInput] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([]);
  const [pricingHighlights, setPricingHighlights] = useState<PricingHighlight[]>([]);
  const [prefersNewPlan, setPrefersNewPlan] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const utils = api.useUtils();

  const {
    data: conversationList,
    isLoading: isLoadingList,
  } = api.chat.listConversations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!conversationList?.length || prefersNewPlan) return;
    setSelectedConversationId((prev) => prev ?? conversationList[0]!.id);
  }, [conversationList, prefersNewPlan]);

  const {
    data: conversationDetail,
    isLoading: isConversationLoading,
  } = api.chat.getConversation.useQuery(
    { conversationId: selectedConversationId! },
    {
      enabled: Boolean(selectedConversationId),
      refetchOnWindowFocus: false,
    },
  );

  const sendMessage = api.chat.sendMessage.useMutation({
    onSuccess: async (data) => {
      setPendingMessages([]);
      setPricingHighlights(data.pricing ?? []);

      if (!selectedConversationId || data.conversationId !== selectedConversationId) {
        setSelectedConversationId(data.conversationId);
      }

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ conversationId: data.conversationId }),
      ]);

      setPrefersNewPlan(false);
    },
    onError: () => {
      setPendingMessages([]);
    },
  });

  const messages = useConversationMessages({
    persistentMessages: conversationDetail?.conversation.messages ?? [],
    pendingMessages,
  });

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pendingMessages.length]);

  const canSend = input.trim().length > 0 && !sendMessage.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setPendingMessages((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: text,
        pending: true,
      },
    ]);

    setInput("");

    sendMessage.mutate({
      message: text,
      conversationId: selectedConversationId ?? undefined,
    });
  };

  const activePlan = conversationDetail?.eventPlan;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-linear-to-br from-indigo-300 via-slate-100 to-pink-300">
      {/* Decorative background */}
      <Backdrop />

      <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 gap-6 px-4 py-8 md:px-6 md:py-10">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 rounded-3xl border border-gray-200/80 bg-white/60 p-4 shadow-xl backdrop-blur lg:flex lg:min-h-0 lg:max-h-[calc(100dvh-5rem)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Event Plans</h2>
            <button
              type="button"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              onClick={() => {
                setSelectedConversationId(null);
                setPricingHighlights([]);
                setPendingMessages([]);
                setPrefersNewPlan(true);
              }}
            >
              New plan
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoadingList ? (
              <p className="text-sm text-gray-500">Loading conversations…</p>
            ) : conversationList?.length ? (
              conversationList.map((conversation) => {
                const isActive = conversation.id === selectedConversationId;
                const name = conversation.eventPlan?.name ?? conversation.title;
                const budget = conversation.eventPlan?.totalBudget
                  ? `${conversation.eventPlan.currency ?? "USD"} ${formatNumber(conversation.eventPlan.totalBudget)}`
                  : "Budget TBD";

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setPricingHighlights([]);
                      setPrefersNewPlan(false);
                    }}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow"
                        : "border-transparent bg-white/70 text-gray-700 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {truncate(name, MAX_CONVERSATION_TITLE)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{budget}</div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Start a plan to see it here.</p>
            )}
          </div>
        </aside>

  <section className="relative flex min-h-[70vh] max-h-[calc(100dvh-5rem)] flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white/70 shadow-xl backdrop-blur lg:min-h-0">
          <header className="flex flex-col gap-2 border-b border-gray-200/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                PW
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">
                  Planwise Assistant
                </div>
                <div className="text-xs text-gray-500">
                  {activePlan?.name ?? "New event plan"}
                </div>
              </div>
            </div>
            {activePlan ? (
              <PlanSnapshot plan={activePlan} pricingHighlights={pricingHighlights} />
            ) : (
              <p className="text-xs text-gray-500">
                Tell me about your event and I’ll set everything up.
              </p>
            )}
          </header>

          <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden px-5 py-4">
            <div
              ref={listRef}
              className="flex-1 min-h-0 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-white/60 p-4 shadow-sm"
            >
              {isConversationLoading ? (
                <p className="text-sm text-gray-500">Loading conversation…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  Say hi to start the conversation.
                </p>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}

              {sendMessage.isPending && (
                <div className="flex">
                  <div className="mr-auto max-w-[85%] animate-pulse rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
                    Thinking…
                  </div>
                </div>
              )}

              {sendMessage.isError && (
                <div className="text-center text-sm text-red-600">
                  {sendMessage.error?.message ?? "Something went wrong"}
                </div>
              )}
            </div>

            {activePlan?.items?.length ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
                <div className="mb-2 font-semibold">Budget tracker</div>
                <ul className="space-y-1">
                  {activePlan.items.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="truncate text-indigo-800">{item.title}</span>
                      <span className="font-medium">
                        {item.currency ?? "USD"} {formatNumber(item.estimatedCost)}
                      </span>
                    </li>
                  ))}
                </ul>
                {activePlan.items.length > 6 ? (
                  <div className="mt-2 text-[11px] text-indigo-700">
                    +{activePlan.items.length - 6} more suggestions saved
                  </div>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for venues, catering, or budgeting tips…"
                className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendMessage.isPending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-44 -left-44 h-96 w-96 rounded-full bg-indigo-300/70 blur-3xl" />
      <div className="absolute top-1/4 left-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="absolute top-1/3 -right-36 h-80 w-80 rounded-full bg-pink-300/70 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-72 w-md -translate-x-1/2 rounded-full bg-purple-300/60 blur-3xl" />
    </div>
  );
}

function useConversationMessages({
  persistentMessages,
  pendingMessages,
}: {
  persistentMessages: Array<{ id: string; role: string; content: string }>;
  pendingMessages: DisplayMessage[];
}) {
  return useMemo(() => {
    return [
      ...persistentMessages.map((message) => ({
        id: message.id,
        role: mapRole(message.role),
        content: message.content,
      })),
      ...pendingMessages,
    ];
  }, [persistentMessages, pendingMessages]);
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  const bubbleBase = isUser
    ? "ml-auto max-w-[80%] rounded-2xl bg-indigo-600 px-4 py-2 text-sm text-white"
    : "mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${bubbleBase} ${message.pending ? "opacity-60" : ""}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className={ASSISTANT_MARKDOWN_CLASSES}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content.replace(/\n{3,}/g, "\n\n")}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanSnapshot({
  plan,
  pricingHighlights,
}: {
  plan: {
    name: string;
    location?: string | null;
    totalBudget?: number | null;
    currency?: string | null;
  };
  pricingHighlights: PricingHighlight[];
}
) {
  return (
    <div className="flex flex-col gap-1 text-xs text-gray-600">
      {plan.location ? <div>Location: {plan.location}</div> : null}
      {plan.totalBudget ? (
        <div>
          Budget: {plan.currency ?? "USD"} {formatNumber(plan.totalBudget)}
        </div>
      ) : null}
      {pricingHighlights?.length ? (
        <div className="text-[11px] text-indigo-600">
          Latest market checks: {pricingHighlights.slice(0, 2).map((item, idx) => (
            <span key={`${item.title}-${idx}`}>
              {item.title}
              {item.priceText ? ` (${item.priceText})` : ""}
              {idx < Math.min(pricingHighlights.length, 2) - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined) return "0";
  if (typeof value === "number") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return formatNumber(parsed);
    }
  }

  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return formatNumber((value as { toNumber: () => number }).toNumber());
  }

  return String(value);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function mapRole(role: string) {
  switch (role) {
    case "USER":
      return "user";
    case "ASSISTANT":
    case "SYSTEM":
    case "TOOL":
    default:
      return "assistant";
  }
}
