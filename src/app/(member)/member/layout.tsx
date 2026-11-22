import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { SideNav } from "@/components/side-nav";
import { requirePageUser } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["MEMBER"]);
  const t = await getTranslations("member.nav");
  return (
    <>
      <AppHeader user={user} />
      <div className="flex flex-1 flex-col md:flex-row">
        <SideNav
          label={t("label")}
          links={[
            ["/member", t("schemes")],
            ["/member/join", t("join")],
            ["/member/draws", t("draws")],
            ["/member/account", t("account")],
          ]}
        />
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </>
  );
}
