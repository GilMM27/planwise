"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = api.chat.sendMessage.useMutation({
    onSuccess: (data, variables) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: data.reply,
        },
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
    <main className="mx-auto flex h-[calc(100dvh-0px)] max-w-3xl flex-col p-4">
      <h1 className="mb-4 text-2xl font-semibold">Chat</h1>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-md border bg-white p-3 shadow-sm"
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
                    ? "ml-auto max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2 text-white"
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

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          className="flex-1 rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendMessage.isPending ? "Sending…" : "Send"}
        </button>
      </form>
    </main>
  );
}
