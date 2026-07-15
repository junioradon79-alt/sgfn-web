"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#produit", label: "Plateforme" },
  { href: "#securite", label: "Confiance" },
  { href: "#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function HomeHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#E3E8EF] bg-[#F7F9FC]/95 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Accueil SGNF">
            <Image src="/logo-embleme.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" priority />
            <div className="hidden border-l border-[#E3E8EF] pl-3 xs:block">
              <p className="font-display text-xl font-extrabold leading-none tracking-tight text-[#0B2E4F]">SGNF</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0F5E8C]">Gestion foncière</p>
            </div>
            <span className="font-display text-xl font-extrabold leading-none tracking-tight text-[#0B2E4F] xs:hidden">SGNF</span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navLinks.map((link) => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0B2E4F]">{link.label}</Link>)}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden h-11 items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0F5E8C] sm:inline-flex">Accéder à la plateforme <ArrowRight className="h-4 w-4" /></Link>
            <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E3E8EF] bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-40 transition-opacity duration-200 lg:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!open}>
        <button type="button" className="absolute inset-0 cursor-default bg-slate-950/30" onClick={close} tabIndex={-1} aria-label="Fermer le menu" />
        <div className={`relative mt-[72px] border-b border-[#E3E8EF] bg-white px-4 pb-6 pt-4 transition-transform duration-200 ${open ? "translate-y-0" : "-translate-y-2"}`}>
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
            {navLinks.map((link) => <Link key={link.href} href={link.href} onClick={close} className="rounded-xl px-4 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[#0B2E4F]">{link.label}</Link>)}
          </nav>
          <Link href="/login" onClick={close} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] text-sm font-bold text-white transition hover:bg-[#0F5E8C]"><ShieldCheck className="h-4 w-4" /> Accéder à la plateforme</Link>
        </div>
      </div>
    </>
  );
}
