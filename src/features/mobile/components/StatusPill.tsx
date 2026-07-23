"use client";

import { Badge } from "@/components/ds/badge";
import { statutLabel, statutTone } from "../data/mappers";

/** Badge de statut de lot, adossé au Design System (mêmes tons partout). */
export function StatusPill({ statut, className }: { statut: string | null | undefined; className?: string }) {
  return (
    <Badge tone={statutTone(statut)} className={className}>
      {statutLabel(statut)}
    </Badge>
  );
}
