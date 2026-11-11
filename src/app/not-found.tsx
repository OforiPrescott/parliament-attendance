import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-serif text-[64px] font-semibold text-gold">404</div>
      <p className="text-[15px] text-muted-foreground">That page or record does not exist.</p>
      <Link href="/dashboard" className="text-primary hover:underline">Go to the dashboard</Link>
    </div>
  );
}
