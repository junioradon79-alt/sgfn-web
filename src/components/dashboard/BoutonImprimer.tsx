"use client";

import { Printer } from "lucide-react";

export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
    >
      <Printer className="h-4 w-4" />
      Imprimer
    </button>
  );
}
