"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState icon={AlertTriangle} title="This page could not be loaded" action={<Button onClick={reset}>Try again</Button>}>
        The error has been logged{error.digest ? ` (reference ${error.digest})` : ""}. If it keeps happening, contact the System Administrator.
      </EmptyState>
    </Card>
  );
}
