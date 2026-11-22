"use client";

import { useTranslations } from "next-intl";

/** The one-time code, shown on screen only while SHOW_OTP_ON_SCREEN is on for testing (never in production). */
export function TestCode({ code }: { code?: string }) {
  const t = useTranslations("common");
  if (!code) return null;
  return (
    <p role="status" className="rounded-lg border-2 border-dashed border-due bg-card px-3 py-2">
      <span className="block text-sm text-due-ink">{t("testCodeNote")}</span>
      <span className="text-2xl font-bold tracking-[0.3em] tabular-nums">{code}</span>
    </p>
  );
}
