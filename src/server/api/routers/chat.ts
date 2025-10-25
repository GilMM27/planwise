import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const chatRouter = createTRPCRouter({
  /**
   * Send a user message and receive a simple bot reply.
   * For now this returns a deterministic response without calling external services.
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message cannot be empty").max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = ctx.session?.user;

      // Simple placeholder bot logic. Replace with your AI/service call.
      const trimmed = input.message.trim();
      const reply =
        trimmed.length < 120
          ? `You said: "${trimmed}"`
          : `Thanks! I received your message (${trimmed.length} chars).`;

      return {
        reply,
        userName: user?.name ?? null,
        at: new Date(),
      };
    }),
});

export type ChatRouter = typeof chatRouter;
