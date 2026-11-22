import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/language-switch";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/session";
import { homeFor } from "@/shared/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-4">
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-3 font-semibold">
          <span aria-hidden className="grid size-11 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            S
          </span>
          {t("app.name")}
        </span>
        <LanguageSwitch />
      </div>
      <div className="glass glass-peach flex min-h-52 flex-col justify-end p-6">
        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">{t("login.hero")}</h1>
        <p className="mt-2 text-white/90">{t("login.heroSub")}</p>
      </div>
      <div className="rounded-[28px] bg-card p-5">
        <LoginForm />
      </div>
      <p className="px-1 text-muted-foreground">
        {t("join.newHere")}{" "}
        <Link href="/join" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4">
          {t("join.title")}
        </Link>
      </p>
    </main>
  );
}
