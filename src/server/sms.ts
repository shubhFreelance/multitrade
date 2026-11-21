export async function sendSms(phone: string, text: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[sms] to ${phone}: ${text}`);
    return;
  }
  // shortcut: no SMS provider yet, wire MSG91 here once the account, sender ID and DLT template exist.
  throw new Error("SMS provider not configured");
}
