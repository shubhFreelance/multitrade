import { Package } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatPaise } from "@/lib/money";
import { listProducts } from "@/server/catalog";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { createProductAction } from "../actions";
import { Chip, IconChip, PageHeader } from "@/components/ui-bits";
import { schemeTone } from "@/components/glass";
import { ProductFields } from "./product-fields";

export default async function ProductsPage() {
  const t = await getTranslations("admin.products");
  const ts = await getTranslations("schemes");
  const products = await listProducts(await requirePageUser(adminRoles));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tone="peach" icon={Package} title={t("title")} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[28px] bg-card">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary">
                <span className="flex items-center gap-3">
                  <IconChip icon={Package} tint={schemeTone[p.schemes[0]] ?? "peach"} />
                  <span className={p.active ? "" : "text-muted-foreground line-through"}>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="flex flex-wrap gap-1.5 pt-1">
                      {p.schemes.map((c) => (
                        <Chip key={c} tint={schemeTone[c] ?? "peach"}>
                          {ts(c)}
                        </Chip>
                      ))}
                      <span className="text-[14px] text-muted-foreground">{t("inStock", { count: p.stock })}</span>
                    </span>
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(p.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3 rounded-[28px] bg-card p-5">
        <h2 className="font-medium">{t("new")}</h2>
        <ActionForm action={createProductAction} submitLabel={t("create")}>
          <ProductFields />
        </ActionForm>
      </section>
      </div>
    </div>
  );
}
