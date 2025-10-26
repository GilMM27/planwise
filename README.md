# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Local development checklist

- Copy `.env.example` to `.env` and fill in the required secrets.
	- `DATABASE_URL` should point to your local Postgres instance (the repo ships with `./start-database.sh`).
	- `SERPAPI_API_KEY` unlocks Google Shopping price lookups through [SerpAPI](https://serpapi.com/). Leave it unset to work offline – the app will fall back to mocked pricing data.
- Start the database container:
	```bash
	./start-database.sh
	```
- Apply Prisma migrations and regenerate the client whenever the schema changes:
	```bash
	npx prisma migrate dev
	npx prisma generate
	```

## Conversation memory & budgeting

The Planwise assistant now persists chats, event plans, and budget items:

- **Conversation history** is stored in the new `Conversation` and `Message` tables, enabling multi-session planning.
- **Event plans** live in `EventPlan` with related `BudgetItem` rows for venue, catering, and other expenses.
- The chat UI lists all plans per user, tracks current budget items, and automatically incorporates stored context in each reply.
- Pricing suggestions are fetched from Google (via SerpAPI) whenever budget-related questions appear, and saved as pending `BudgetItem` records for later review.
