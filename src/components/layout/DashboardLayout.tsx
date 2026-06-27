"use client";

import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";

type Props = {
  nom: string;
  children: React.ReactNode;
};

export default function DashboardLayout({
  nom,
  children,
}: Props) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <DashboardHeader nom={nom} />

        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}