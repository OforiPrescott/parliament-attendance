import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listConstituencies, listRegions } from "@/lib/queries";
import { PageHeader } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { ConstituencyManager, RegionManager } from "./manager";

export const metadata: Metadata = { title: "Constituencies" };

export default async function ConstituenciesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("mps.view");
  const tab = (await searchParams).tab === "regions" ? "regions" : "constituencies";
  const [constituencies, regions] = await Promise.all([listConstituencies(), listRegions()]);
  const manage = can(user.permissions, "reference.manage");
  return (
    <>
      <PageHeader eyebrow="Registry" title="Constituencies & regions" description="Electoral constituencies, the regions they belong to, and their sitting members." />
      <LinkTabs active={tab} tabs={[
        { key: "constituencies", label: "Constituencies", href: "/constituencies", count: constituencies.length },
        { key: "regions", label: "Regions", href: "/constituencies?tab=regions", count: regions.length },
      ]} />
      {tab === "regions"
        ? <RegionManager regions={regions} canManage={manage} />
        : <ConstituencyManager items={constituencies} regions={regions} canManage={manage} />}
    </>
  );
}
