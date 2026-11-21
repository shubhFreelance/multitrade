import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["hi", "en"] as const;

// No locale in the URL: the language comes from the `locale` cookie (set at login from User.language). Hindi by default.
export default getRequestConfig(async () => {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "hi";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
