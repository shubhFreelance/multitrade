import { AppHeader } from "@/components/app-header";
import { requirePageUser } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  return (
    <>
      <AppHeader user={user} />
      <main className="flex-1 p-4">{children}</main>
    </>
  );
}
