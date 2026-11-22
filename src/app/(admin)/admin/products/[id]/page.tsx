import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { getProduct } from "@/server/catalog";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { updateProductAction } from "../../actions";
import { ProductFields } from "../product-fields";

export default async function ProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const t = await getTranslations("admin.products");
  const tc = await getTranslations("common");
  const product = await getProduct(await requirePageUser(adminRoles), (await params).id);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <h1 className="text-xl font-semibold">{product.name}</h1>
      <ActionForm action={updateProductAction.bind(null, product.id)} submitLabel={tc("save")}>
        <ProductFields product={product} />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="active" defaultChecked={product.active} className="size-5" />
          {t("active")}
        </label>
      </ActionForm>
    </div>
  );
}
