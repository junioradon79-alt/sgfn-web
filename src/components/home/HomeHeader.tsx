"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { X, Menu } from "lucide-react";

const navLinks = [
  { href: "#apropos", label: "À propos" },
  { href: "#chiffres", label: "Chiffres" },
  { href: "#fonctions", label: "Fonctionnalités" },
  { href: "#processus", label: "Processus" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function HomeHeader() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/40 bg-[#F8FAFC]/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <Image
              src="/logo-officiel.png"
              alt="Logo Officiel SGFN"
              width={44}
              height={44}
              className="object-contain"
              style={{ height: "auto" }}
              priority
            />
            <div className="hidden xs:flex h-9 w-[1px] bg-slate-200" />
            <div className="hidden xs:flex flex-col">
              <span className="font-display font-black text-xl leading-none tracking-tight text-[#0D3B66]">
                SGFN
              </span>
              <span className="mt-0.5 text-[10px] font-sans uppercase tracking-[0.18em] text-[#1E6091] leading-none">
                Gestion Foncière Numérique
              </span>
            </div>
            <span className="xs:hidden font-display font-black text-xl leading-none tracking-tight text-[#0D3B66]">
              SGFN
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="py-2 hover:text-[#0D3B66] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* CTA desktop + hamburger mobile */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[#0D3B66] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091] active:scale-[0.98]"
            >
              Ouvrir la plateforme
            </Link>

            <button
              onClick={() => setOpen(!open)}
              aria-label="Menu"
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile — overlay (toujours dans le DOM, masqué par CSS quand fermé) */}
      <div
        aria-hidden={!open}
        className={`lg:hidden fixed inset-0 z-40 flex flex-col transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={close}
        />

        {/* Panel (en dessous du header) */}
        <div
          className={`relative mt-16 bg-white border-b border-slate-200 shadow-xl px-4 pt-4 pb-6 transition-transform duration-200 ${
            open ? "translate-y-0" : "-translate-y-2"
          }`}
        >
          <nav className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="flex items-center rounded-xl px-4 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-[#0D3B66]/6 hover:text-[#0D3B66] active:scale-[0.98]"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
              href="/login"
              onClick={close}
              className="flex h-12 items-center justify-center rounded-2xl bg-[#0D3B66] text-sm font-bold text-white shadow-sm transition hover:bg-[#1E6091] active:scale-[0.98]"
            >
              Ouvrir la plateforme
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
