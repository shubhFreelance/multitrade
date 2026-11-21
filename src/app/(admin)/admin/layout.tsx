import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { requirePageUser } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  const t = await getTranslations("admin.nav");
  const links = [
    ["/admin", t("home")],
    ["/admin/schemes", t("schemes")],
    ["/admin/batches", t("batches")],
    ["/admin/products", t("products")],
  ];
  return (
    <>
      <AppHeader user={user} />
      <nav className="flex gap-1 overflow-x-auto border-b px-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="px-3 py-3 text-sm font-medium whitespace-nowrap hover:underline">
            {label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
    </>
  );
}
