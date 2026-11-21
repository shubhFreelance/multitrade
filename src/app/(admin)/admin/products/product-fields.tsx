import { getTranslations } from "next-intl/server";
import { Field } from "@/components/field";
import { paiseToRupees } from "@/lib/money";
import { schemeCodes } from "@/shared/catalog";

type Product = { name: string; nameHi: string | null; price: number; schemes: string[]; stock: number };

/** Inputs shared by the create and edit product forms. */
export async function ProductFields({ product }: { product?: Product }) {
  const t = await getTranslations("admin.products");
  const ts = await getTranslations("schemes");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("name")} name="name" defaultValue={product?.name} required />
      <Field label={t("nameHi")} name="nameHi" defaultValue={product?.nameHi ?? ""} />
      <Field label={t("price")} name="price" inputMode="decimal" defaultValue={product ? paiseToRupees(product.price) : ""} required />
      <Field label={t("stock")} name="stock" type="number" min={0} defaultValue={product?.stock ?? 0} required />
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">{t("schemes")}</legend>
        {schemeCodes.map((code) => (
          <label key={code} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="schemes" value={code} defaultChecked={product?.schemes.includes(code)} className="size-5" />
            {ts(code)}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
