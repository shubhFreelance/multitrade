import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { SideNav } from "@/components/side-nav";
import { requirePageUser } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["AGENT"]);
  const t = await getTranslations("agent.nav");
  return (
    <>
      <AppHeader user={user} />
      <div className="flex flex-1 flex-col md:flex-row md:pt-2">
        <SideNav
          label={t("label")}
          mobile="dock"
          links={[
            { href: "/agent", text: t("home"), short: t("short.home"), icon: "home" },
            { href: "/agent/members", text: t("members"), short: t("short.members"), icon: "members" },
            { href: "/agent/enrol", text: t("enrol"), short: t("short.enrol"), icon: "enrol" },
            { href: "/agent/commission", text: t("commission"), short: t("short.commission"), icon: "commission" },
          ]}
        />
        <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 pb-28 md:px-8 md:pt-0 md:pb-10">{children}</main>
      </div>
    </>
  );
}
