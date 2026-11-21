import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("member");
  return <h1 className="text-xl font-semibold">{t("title")}</h1>;
}
