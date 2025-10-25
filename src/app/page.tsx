import Link from "next/link";
import Image from "next/image";
import { auth, signIn, signOut } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  async function handleGoogleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/chat" });
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-linear-to-br from-indigo-300 via-slate-100 to-pink-300">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-44 -left-44 h-96 w-96 rounded-full bg-indigo-300/70 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute top-1/3 -right-36 h-80 w-80 rounded-full bg-pink-300/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-md -translate-x-1/2 rounded-full bg-purple-300/60 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20">
        <header className="mb-12 flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Image
                src="/PW_white.png"
                alt="Planwise"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <span className="text-lg font-semibold text-gray-900">
              Planwise
            </span>
          </div>

          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-600 sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <Link
                href="/chat"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
              >
                Open Chat
              </Link>
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <form action={handleGoogleSignIn}>
              <button
                type="submit"
                className="group inline-flex items-center gap-3 rounded-full bg-gray-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-gray-900/20 backdrop-blur hover:bg-gray-900"
              >
                <GoogleIcon className="h-5 w-5" />
                Continue with Google
              </button>
            </form>
          )}
        </header>

        <section className="relative w-full overflow-hidden rounded-3xl border border-gray-200 bg-white/70 p-10 shadow-xl backdrop-blur">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h1 className="text-4xl leading-tight font-bold text-balance text-gray-900 md:text-5xl">
                Plan smarter. Execute faster.
              </h1>
              <p className="mt-5 max-w-prose text-pretty text-gray-600 md:text-lg">
                Connect with friends and colleagues by planning meets, events,
                parties and much more without the hassle of managing everyone's
                finances! With its AI integration you may easily bounce ideas,
                get realistic budget estimates and track expenses all in one
                place.
              </p>

              {session?.user ? (
                <div className="mt-8 flex items-center gap-3">
                  <Link
                    href="/chat"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                  >
                    Go to Chat
                  </Link>
                  <span className="text-sm text-gray-500">
                    You’re signed in.
                  </span>
                </div>
              ) : (
                <form action={handleGoogleSignIn} className="mt-8">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-3 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                  >
                    <GoogleIcon className="h-5 w-5" />
                    Sign in with Google
                  </button>
                </form>
              )}
            </div>

            <div className="relative hidden md:flex md:items-end md:justify-end">
              <div className="absolute -top-10 -left-10 h-40 w-40 rounded-3xl bg-indigo-100 blur-xl" />
              <div className="absolute -right-6 -bottom-8 h-36 w-36 rounded-3xl bg-pink-100 blur-xl" />
              <div className="relative z-10">
                <ChatMockup />
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-16 text-xs text-gray-500">
          © {new Date().getFullYear()} Planwise. All rights reserved.
        </footer>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-1.6 3.6-5.4 3.6-3.2 0-5.8-2.6-5.8-5.8S8.8 6.1 12 6.1c1.8 0 3 .8 3.6 1.4l2.5-2.5C16.8 3.5 14.6 2.6 12 2.6 6.9 2.6 2.8 6.7 2.8 11.8S6.9 21 12 21c6 0 9.9-4.2 9.9-10.1 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function ChatMockup() {
  return (
    <div className="w-88 rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-xl backdrop-blur">
      {/* header */}
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          <Image
            src="/PW_white.png"
            alt="Planwise"
            width={36}
            height={36}
            className="object-cover"
          />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            Planwise Assistant
          </div>
          <div className="text-xs text-gray-500">Online</div>
        </div>
      </div>

      {/* messages */}
      <div className="max-h-80 space-y-2 overflow-hidden">
        <div className="flex">
          <div className="mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900">
            Hi! I can help you plan your next meetup. What’s your budget and
            headcount?
          </div>
        </div>
        <div className="flex">
          <div className="ml-auto max-w-[80%] rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white">
            We’re 8 people with a $300 budget.
          </div>
        </div>
        <div className="flex">
          <div className="mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900">
            Great! Here’s a quick split: venue $120, food $140, extras $40. Want
            an itemized list?
          </div>
        </div>
        <div className="flex">
          <div className="ml-auto max-w-[80%] rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white">
            Yes, please.
          </div>
        </div>
        <div className="flex">
          <div className="mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
            Typing…
          </div>
        </div>
      </div>

      {/* input (mock) */}
      <div className="mt-3 flex items-center gap-2">
        <input
          disabled
          placeholder="Type a message"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
        <button
          disabled
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
