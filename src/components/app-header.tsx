import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import type { SessionUser } from "@/shared/auth";

export async function AppHeader({ user }: { user: SessionUser }) {
  const t = await getTranslations("app");
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
          S
        </span>
        <div className="min-w-0">
          <p className="truncate leading-tight font-semibold">{t("name")}</p>
          <p className="truncate text-sm leading-tight text-muted-foreground">{user.name}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <LanguageSwitch />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-card px-3 text-[15px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:bg-muted sm:px-4"
          >
            <LogOut aria-hidden className="size-[18px]" />
            {/* Icon only on narrow phones; screen readers always get the word. */}
            <span className="sr-only sm:not-sr-only">{t("logout")}</span>
          </button>
        </form>
      </div>
    </header>
  );
}
