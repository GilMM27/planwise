import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import ChatClient from "./_components/ChatClient";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  return <ChatClient />;
}
