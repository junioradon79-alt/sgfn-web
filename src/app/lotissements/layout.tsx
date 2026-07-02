import React from "react";
import { Sidebar } from "@/components/ui/Sidebar";

export default function LotissementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 h-full shrink-0 bg-white border-r border-slate-200/60 flex flex-col z-40">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col h-full bg-[#F8FAFC]">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200/60 z-30">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center text-xs text-slate-500 space-x-1 select-none">
              <li className="font-medium text-slate-400/90">SGNF</li>
              <li><span className="mx-2 text-slate-300">/</span></li>
              <li className="font-semibold text-slate-700">Lotissements</li>
            </ol>
          </nav>
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold hover:bg-slate-200 transition focus:outline-none"
            title="Mon profil"
          >
            <span className="text-sm select-none">AB</span>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
