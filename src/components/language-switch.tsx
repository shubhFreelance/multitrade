"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LanguageSwitch() {
  const t = useTranslations("app");
  const locale = useLocale();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="h-11 px-4"
      onClick={async () => {
        await setLocaleAction(locale === "hi" ? "en" : "hi");
        router.refresh();
      }}
    >
      {t("switchLanguage")}
    </Button>
  );
}
