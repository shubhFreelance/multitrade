import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/shared/auth";

export async function AppHeader({ user }: { user: SessionUser }) {
  const t = await getTranslations("app");
  return (
    <header className="flex items-center justify-between gap-2 border-b p-4">
      <div className="min-w-0">
        <p className="font-semibold">{t("name")}</p>
        <p className="truncate text-sm text-muted-foreground">{user.name}</p>
      </div>
      <div className="flex gap-2">
        <LanguageSwitch />
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="h-11 px-4">{t("logout")}</Button>
        </form>
      </div>
    </header>
  );
}
