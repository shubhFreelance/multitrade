import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MemberDetail } from "@/components/network";
import { toAppError } from "@/server/errors";
import { getNetworkEnrolment } from "@/server/network";
import { requirePageUser } from "@/server/session";

export default async function AdminMemberPage({ params }: PageProps<"/admin/network/members/[id]">) {
  const t = await getTranslations("network");
  const tc = await getTranslations("common");
  const e = await getNetworkEnrolment(await requirePageUser(["SUPER_ADMIN"]), (await params).id).catch((err) =>
    toAppError(err).code === "NOT_FOUND" ? notFound() : Promise.reject(err),
  );
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href={e.agentId ? `/admin/network/${e.agentId}` : "/admin/network"} className="-my-2 inline-flex min-h-11 items-center self-start text-[15px] hover:underline">
        ← {tc("back")}
      </Link>
      <p className="text-muted-foreground">{e.agent ? t("enrolledBy", { name: e.agent.name, phone: e.agent.phone }) : t("direct")}</p>
      <MemberDetail e={e} />
    </div>
  );
}
