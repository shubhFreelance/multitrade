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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("app.name")}</h1>
        <LanguageSwitch />
      </div>
      <LoginForm />
    </main>
  );
}
