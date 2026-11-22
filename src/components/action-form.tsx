"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type FormState = { error?: string; ok?: boolean };

/** A form posting to a server action, with a submit button and the action's error or "saved" message. */
export function ActionForm({
  action,
  submitLabel,
  confirm,
  buttonClassName = "h-11 self-start px-6",
  children,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  /** If set, asks this question first and only submits on OK. For actions that are hard to undo. */
  confirm?: string;
  buttonClassName?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={confirm ? (e) => !window.confirm(confirm) && e.preventDefault() : undefined}
      className="flex flex-col gap-3"
    >
      {children}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.ok && !pending && <p className="text-sm text-muted-foreground">{t("common.saved")}</p>}
      <Button type="submit" className={buttonClassName} disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
