"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ds/button";

export function BoutonImprimer() {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      <Printer />
      Imprimer
    </Button>
  );
}
