"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

const NAV = [
  { href: "#produit", label: "Produit" },
  { href: "#modules", label: "Modules" },
  { href: "#roles", label: "Rôles" },
  { href: "#cartographie", label: "Cartographie" },
  { href: "#marketplace", label: "Marketplace" },
  { href: "#securite", label: "Sécurité" },
  { href: "#partenaires", label: "Partenaires" },
  { href: "#faq", label: "FAQ" },
];

export function VitrineHeader() {
  const { isDark, setTheme } = useTheme();
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-[100] h-[76px] border-b bg-card/90 backdrop-blur-xl transition-[border-color,box-shadow] duration-300",
          scrolled ? "border-border shadow-[0_1px_2px_rgba(15,23,42,.05)]" : "border-transparent",
        )}
      >
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-7 px-5 sm:px-7">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Accueil SGNF">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary p-[3px] shadow-[0_4px_10px_rgba(11,77,136,.28)]">
              <span className="flex size-full items-center justify-center overflow-hidden rounded-[7px] bg-white">
                <Image src="/logo-embleme.png" alt="" width={26} height={26} className="object-contain" priority />
              </span>
            </span>
            <span className="font-display text-[17px] font-extrabold tracking-tight text-foreground">SGNF</span>
          </Link>

          {/* Points de rupture repris du handoff : liens et « Se connecter »
              cèdent la place au menu sous 1181 px, et l'appel à l'action
              disparaît sous 481 px — sans quoi le groupe d'actions déborde
              de 13 px sur un écran de 390. Le tiroir les propose tous deux. */}
          <nav className="hidden flex-wrap items-center gap-6 min-[1181px]:flex" aria-label="Sections">
            {NAV.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Changer de thème"
              className="flex size-[38px] items-center justify-center rounded-[11px] border border-border-strong bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              {isDark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
            </button>
            <Link
              href="/login"
              className="hidden px-3.5 py-2 text-[13.5px] font-semibold text-foreground transition-colors hover:text-primary min-[1181px]:inline-block"
            >
              Se connecter
            </Link>
            <Link
              href="/contact"
              className="hidden items-center gap-1.5 rounded-[11px] bg-primary px-4 py-2.5 text-[13.5px] font-bold text-primary-foreground shadow-[0_4px_14px_rgba(11,77,136,.26)] transition-colors hover:bg-primary-700 min-[481px]:inline-flex"
            >
              Demander une démo
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOpen}
              className="flex size-[38px] items-center justify-center rounded-[11px] border border-border-strong bg-card text-foreground min-[1181px]:hidden"
            >
              {menuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="sticky top-[76px] z-[99] flex flex-col border-b border-border bg-card px-5 pb-4 pt-2 shadow-[0_16px_32px_rgba(15,23,42,.12)] min-[1181px]:hidden">
          {NAV.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "px-1.5 py-3 text-[14.5px] font-semibold text-foreground",
                i < NAV.length - 1 && "border-b border-border",
              )}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-3.5 flex gap-2.5">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="flex-1 rounded-[10px] border border-border-strong py-3 text-center text-sm font-bold text-foreground"
            >
              Se connecter
            </Link>
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary py-3 text-center text-sm font-bold text-primary-foreground"
            >
              Demander une démo <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
