"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { sendOtpAction, verifyOtpAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TestCode } from "@/components/test-code";

export function LoginForm() {
  const t = useTranslations();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string>();
  const [testCode, setTestCode] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const res = await sendOtpAction(phone);
      setError(res.error);
      setTestCode(res.testCode);
      if (!res.error) setStep("code");
    });

  const verify = () =>
    startTransition(async () => {
      const res = await verifyOtpAction(phone, code); // redirects on success
      setError(res?.error);
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") send();
        else verify();
      }}
    >
      <h2 className="text-lg font-medium">{t("login.title")}</h2>

      {step === "phone" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("login.phone")}</Label>
          <Input
            id="phone"
            className="h-12 text-lg"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder={t("login.phoneHint")}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("login.codeSentTo", { phone })}</p>
          <TestCode code={testCode} />
          <Label htmlFor="code">{t("login.code")}</Label>
          <Input
            id="code"
            className="h-12 text-lg tracking-widest"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      <Button type="submit" className="h-12 text-base" disabled={pending}>
        {step === "phone" ? t("login.sendCode") : t("login.verify")}
      </Button>

      {step === "code" && (
        <div className="flex justify-between">
          <Button type="button" variant="link" onClick={() => { setStep("phone"); setCode(""); setError(undefined); }}>
            {t("login.changeNumber")}
          </Button>
          <Button type="button" variant="link" disabled={pending} onClick={send}>
            {t("login.resend")}
          </Button>
        </div>
      )}
    </form>
  );
}
