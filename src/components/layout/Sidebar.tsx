"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Square,
  Users,
  CreditCard,
  FileText,
  Settings,
  Shield,
} from "lucide-react";
import clsx from "clsx";

const menu = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Lotissements",
    href: "/lotissements",
    icon: Map,
  },
  {
    label: "Lots",
    href: "/lots",
    icon: Square,
  },
  {
    label: "Attributaires",
    href: "/attributaires",
    icon: Users,
  },
  {
    label: "Paiements",
    href: "/paiements",
    icon: CreditCard,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileText,
  },
  {
    label: "Administration",
    href: "/admin",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-72 flex-col bg-slate-900 text-white">

      {/* Logo */}

      <div className="border-b border-slate-800 px-8 py-8">

        <h1 className="text-3xl font-bold">
          SGFN
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Système de Gestion du Foncier Numérique
        </p>

      </div>

      {/* Menu */}

      <nav className="flex-1 p-4">

        {menu.map((item) => {

          const Icon = item.icon;

          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "mb-2 flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-200",
                active
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon size={20} />

              <span className="font-medium">
                {item.label}
              </span>

            </Link>
          );
        })}

      </nav>

      {/* Utilisateur */}

      <div className="border-t border-slate-800 p-6">

        <div className="rounded-xl bg-slate-800 p-4">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold">
              A
            </div>

            <div>

              <p className="font-semibold">
                Administrateur SGFN
              </p>

              <div className="mt-1 flex items-center gap-1 text-sm text-slate-400">

                <Shield size={14} />

                Administrateur

              </div>

            </div>

          </div>

        </div>

      </div>

    </aside>
  );
}