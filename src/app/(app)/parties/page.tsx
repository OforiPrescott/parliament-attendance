import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listParties } from "@/lib/queries";
import { aggregate, rate } from "@/lib/stats";
import { PageHeader } from "@/components/ui/misc";
import { PartiesManager } from "./parties-manager";

export const metadata: Metadata = { title: "Political parties" };

export default async function PartiesPage() {
  const user = await requireUser("mps.view");
  const parties = await listParties();
  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const rates = await Promise.all(parties.map((p) => aggregate({ partyId: p.id, from: since, sittingType: "PLENARY" })));
  return (
    <>
      <PageHeader eyebrow="Registry" title="Political parties" description="Parties represented in Parliament. Attendance shown is for plenary sittings in the last 12 months." />
      <PartiesManager
        canManage={can(user.permissions, "reference.manage")}
        parties={parties.map((p, i) => ({ ...p, rate: rates[i].expected ? rate(rates[i]) : null, records: rates[i].expected }))}
      />
    </>
  );
}
