"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
};

export default function ChatClient() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = api.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, role: "bot", content: data.reply },
      ]);
    },
  });

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !sendMessage.isPending,
    [input, sendMessage.isPending],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // Optimistically add user message
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");

    // Call backend
    sendMessage.mutate({ message: text });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-linear-to-br from-indigo-300 via-slate-100 to-pink-300">
      {/* Decorative background (match landing) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-44 -left-44 h-96 w-96 rounded-full bg-indigo-300/70 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute top-1/3 -right-36 h-80 w-80 rounded-full bg-pink-300/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-md -translate-x-1/2 rounded-full bg-purple-300/60 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col px-6 py-10">
        <section className="relative w-full overflow-hidden rounded-3xl border border-gray-200 bg-white/70 p-4 shadow-xl backdrop-blur md:p-6">
          {/* Chat header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                PW
              </div>
              <div>
                <div className="text-base font-medium text-gray-900">
                  Planwise Assistant
                </div>
                <div className="text-xs text-gray-500">Chat</div>
              </div>
            </div>
          </div>

          {/* Messages list */}
          <div
            ref={listRef}
            className="max-h-[60vh] min-h-[45vh] space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-white/60 p-3 shadow-sm"
          >
            {messages.length === 0 ? (
              <div className="text-center text-sm text-gray-500">
                Say hi to start the conversation.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex">
                  <div
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl bg-indigo-600 px-4 py-2 text-white"
                        : "mr-auto max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2 text-gray-900"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}

            {sendMessage.isPending && (
              <div className="flex">
                <div className="mr-auto max-w-[85%] animate-pulse rounded-2xl bg-gray-100 px-4 py-2 text-gray-500">
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

          {/* Input */}
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendMessage.isPending ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
