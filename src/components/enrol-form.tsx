"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { confirmEnrolmentAction, sendEnrolmentCodeAction } from "@/app/(agent)/agent/actions";
import { confirmJoinAction, sendJoinCodeAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TestCode } from "@/components/test-code";

export type BatchOption = { id: string; text: string };

function TextField(props: { id: string; label: string; value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  const { id, label, value, onChange, ...rest } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-12 text-base" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

/** Two steps: phone and batch, then the code (and details for a new member). "agent": an agent enrols someone; "join": a person joins directly. */
export function EnrolForm({ batches, mode = "agent" }: { batches: BatchOption[]; mode?: "agent" | "join" }) {
  const ns = mode === "agent" ? "agent.enrol" : "join";
  const t = useTranslations();
  const [step, setStep] = useState<"start" | "confirm" | "done">("start");
  const [f, setF] = useState({ phone: "", batchId: batches[0]?.id ?? "", name: "", village: "", address: "", nominee: "", code: "" });
  const [existing, setExisting] = useState(false);
  const [testCode, setTestCode] = useState<string>();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const digits = (k: "phone" | "code") => (v: string) => set(k)(v.replace(/\D/g, ""));

  const sendCode = () =>
    startTransition(async () => {
      const res = await (mode === "agent" ? sendEnrolmentCodeAction : sendJoinCodeAction)(f.phone, f.batchId);
      if ("error" in res) return setError(res.error);
      setError(undefined);
      setExisting(res.existingMember);
      setTestCode(res.testCode);
      setStep("confirm");
    });

  const confirm = () =>
    startTransition(async () => {
      const details = existing ? {} : { name: f.name, village: f.village, address: f.address, nominee: f.nominee || undefined };
      const input = { phone: f.phone, batchId: f.batchId, code: f.code, ...details };
      const res = mode === "agent" ? await confirmEnrolmentAction(input) : await confirmJoinAction(input); // join redirects on success
      if ("error" in res && res.error) return setError(res.error);
      setError(undefined);
      if ("tokenNumber" in res) setToken(res.tokenNumber);
      setStep("done");
    });

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border p-4" role="status">
        <p>{t(`${ns}.done`)}</p>
        <p className="text-2xl font-semibold tracking-wide">{token}</p>
        <Button
          className="h-12 self-start px-6"
          onClick={() => {
            setF({ ...f, phone: "", name: "", village: "", address: "", nominee: "", code: "" });
            setStep("start");
          }}
        >
          {t(`${ns}.another`)}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "start") sendCode();
        else confirm();
      }}
    >
      {step === "start" ? (
        <>
          <TextField id="phone" label={t(`${ns}.phone`)} value={f.phone} onChange={digits("phone")} inputMode="numeric" maxLength={10} required autoFocus />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch">{t(`${ns}.batch`)}</Label>
            <select id="batch" className="h-12 rounded-lg border border-input bg-transparent px-2.5" value={f.batchId} onChange={(e) => set("batchId")(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.text}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t(`${ns}.${existing ? "existingMember" : "newMember"}`, { phone: f.phone })}
          </p>
          <TestCode code={testCode} />
          {!existing && (
            <>
              <TextField id="name" label={t(`${ns}.name`)} value={f.name} onChange={set("name")} required />
              <TextField id="village" label={t(`${ns}.village`)} value={f.village} onChange={set("village")} required />
              <TextField id="address" label={t(`${ns}.address`)} value={f.address} onChange={set("address")} required />
              <TextField id="nominee" label={t(`${ns}.nominee`)} value={f.nominee} onChange={set("nominee")} />
            </>
          )}
          <TextField
            id="code"
            label={t(`${ns}.code`)}
            value={f.code}
            onChange={digits("code")}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            required
          />
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      <Button type="submit" className="h-12 text-base" disabled={pending}>
        {step === "start" ? t(`${ns}.sendCode`) : t(`${ns}.confirm`)}
      </Button>
      {step === "confirm" && (
        <Button type="button" variant="link" className="self-start" onClick={() => { setStep("start"); setF({ ...f, code: "" }); setError(undefined); }}>
          {t(`${ns}.back`)}
        </Button>
      )}
    </form>
  );
}
