import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { SideNav, type NavLink } from "@/components/side-nav";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(adminRoles);
  const t = await getTranslations("admin.nav");
  const links: NavLink[] = [
    { href: "/admin", text: t("home"), icon: "home" },
    { href: "/admin/cash", text: t("cash"), icon: "cash" },
    { href: "/admin/fulfilment", text: t("fulfilment"), icon: "fulfilment" },
    { href: "/admin/draws", text: t("draws"), icon: "draws" },
    { href: "/admin/agents", text: t("agents"), icon: "agents" },
    ...(user.role === "SUPER_ADMIN"
      ? ([
          { href: "/admin/network", text: t("network"), icon: "network" },
          { href: "/admin/campaign", text: t("campaign"), icon: "campaign" },
          { href: "/admin/invoices", text: t("invoices"), icon: "invoices" },
        ] as NavLink[])
      : []),
    { href: "/admin/schemes", text: t("schemes"), icon: "schemes" },
    { href: "/admin/batches", text: t("batches"), icon: "batches" },
    { href: "/admin/products", text: t("products"), icon: "products" },
  ];
  return (
    <>
      <AppHeader user={user} />
      <div className="flex flex-1 flex-col gap-3 pt-2 md:flex-row md:gap-0">
        <SideNav label={t("label")} links={links} mobile="pills" />
        <main className="mx-auto w-full max-w-4xl min-w-0 flex-1 p-4 md:px-6 md:pt-0">{children}</main>
      </div>
    </>
  );
}
