"use client";

import { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Official logo slot. Place Parliament's high-resolution logo at
 *   public/branding/parliament-logo.png   (transparent PNG, square, ≥ 512 px)
 * Until then a neutral placeholder mark is shown — the system never
 * generates or approximates the official emblem.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed)
    return (
      <span
        style={{ width: size, height: size }}
        title="Add the official logo at public/branding/parliament-logo.png"
        className={cn("grid shrink-0 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40", className)}
      >
        <Landmark style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src="/branding/parliament-logo.png"
      alt="Parliament of Ghana"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
