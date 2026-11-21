import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { homeFor } from "@/shared/auth";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
