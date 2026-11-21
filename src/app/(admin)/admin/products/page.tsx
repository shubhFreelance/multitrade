import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatPaise } from "@/lib/money";
import { listProducts } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";
import { createProductAction } from "../actions";
import { ProductFields } from "./product-fields";

export default async function ProductsPage() {
  const t = await getTranslations("admin.products");
  const ts = await getTranslations("schemes");
  const products = await listProducts(await getCurrentUser());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-2 p-4 hover:bg-muted">
                <span className={p.active ? "" : "text-muted-foreground line-through"}>
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.schemes.map((c) => ts(c)).join(", ")} · {t("inStock", { count: p.stock })}
                  </span>
                </span>
                <span>{formatPaise(p.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-medium">{t("new")}</h2>
        <ActionForm action={createProductAction} submitLabel={t("create")}>
          <ProductFields />
        </ActionForm>
      </section>
    </div>
  );
}
