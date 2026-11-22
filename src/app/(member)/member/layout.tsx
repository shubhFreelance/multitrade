import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { SideNav } from "@/components/side-nav";
import { countUnread } from "@/server/completion";
import { requirePageUser } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["MEMBER"]);
  const t = await getTranslations("member.nav");
  const unread = await countUnread(user);
  return (
    <>
      <AppHeader user={user} />
      <div className="flex flex-1 flex-col md:flex-row md:pt-2">
        <SideNav
          label={t("label")}
          mobile="dock"
          links={[
            { href: "/member", text: t("schemes"), short: t("short.schemes"), icon: "home" },
            { href: "/member/join", text: t("join"), short: t("short.join"), icon: "join" },
            { href: "/member/draws", text: t("draws"), short: t("short.draws"), icon: "draws" },
            { href: "/member/messages", text: t("messages"), short: t("short.messages"), icon: "messages", badge: unread },
            { href: "/member/account", text: t("account"), short: t("short.account"), icon: "me" },
          ]}
        />
        <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 pb-28 md:px-8 md:pt-0 md:pb-10">{children}</main>
      </div>
    </>
  );
}
