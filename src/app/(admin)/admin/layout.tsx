import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(adminRoles);
  const t = await getTranslations("admin.nav");
  const links = [
    ["/admin", t("home")],
    ["/admin/schemes", t("schemes")],
    ["/admin/batches", t("batches")],
    ["/admin/products", t("products")],
    ["/admin/agents", t("agents")],
    ["/admin/cash", t("cash")],
    ["/admin/draws", t("draws")],
    ["/admin/fulfilment", t("fulfilment")],
    ...(user.role === "SUPER_ADMIN"
      ? [
          ["/admin/network", t("network")],
          ["/admin/campaign", t("campaign")],
          ["/admin/invoices", t("invoices")],
        ]
      : []),
  ];
  return (
    <>
      <AppHeader user={user} />
      <nav className="flex flex-wrap gap-x-1 border-b px-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="px-3 py-2.5 text-[15px] font-medium whitespace-nowrap hover:underline">
            {label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
    </>
  );
}
