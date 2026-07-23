"use client";

import { Check } from "lucide-react";

/** Bandeau bas éphémère (piloté par MobileApp, qui gère le minuteur). */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-[76px] z-30 flex items-center gap-2.5 rounded-2xl bg-foreground px-4 py-3 text-[13px] font-semibold text-background shadow-float [animation:sgnf-fade_.25s_ease]">
      <Check className="size-[18px] flex-none" strokeWidth={2.4} />
      {message}
    </div>
  );
}
