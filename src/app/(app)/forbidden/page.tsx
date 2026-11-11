import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function Forbidden() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState icon={ShieldOff} title="You don't have access to that page" action={<Link href="/dashboard" className="text-primary hover:underline">Return to the dashboard</Link>}>
        Your role does not include this function. If you need it for your work, ask the System Administrator to review your role.
      </EmptyState>
    </Card>
  );
}
