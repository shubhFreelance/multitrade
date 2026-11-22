import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { runDailyAction } from "./actions";

export default async function Page() {
  const t = await getTranslations("admin");
  const user = await requirePageUser(adminRoles);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {user.role === "SUPER_ADMIN" && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border">
          <h2 className="text-lg font-semibold">{t("daily.title")}</h2>
          <p className="text-muted-foreground">{t("daily.intro")}</p>
          <ActionForm action={runDailyAction} submitLabel={t("daily.run")} />
        </section>
      )}
    </div>
  );
}
