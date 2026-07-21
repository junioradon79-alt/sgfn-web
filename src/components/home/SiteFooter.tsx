import Image from "next/image";
import Link from "next/link";

type FooterColumn = { title: string; links: { label: string; href: string; external?: boolean }[] };

const columns: FooterColumn[] = [
  {
    title: "Produit",
    links: [
      { label: "Modules", href: "/#modules" },
      { label: "Cartographie", href: "/#cartographie" },
      // Site public distinct, hors export statique de sgfn.ci.
      { label: "TerraCI Market", href: "https://monterrain.sgfn.ci", external: true },
      { label: "Sécurité", href: "/#securite" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Questions fréquentes", href: "/#faq" },
      { label: "Vérifier un document", href: "/verifier" },
      { label: "Passeport parcelle", href: "/passeport" },
      { label: "Guide d'achat d'un terrain", href: "/guide-achat" },
      { label: "Mode d'emploi saisie", href: "/mode-emploi-saisie" },
    ],
  },
  {
    title: "Partenaires",
    links: [
      { label: "Métiers & partenaires", href: "/metiers-partenaires" },
      { label: "Devenir géomètre-expert", href: "/devenir-geometre" },
      { label: "À propos de SGNF", href: "/a-propos" },
    ],
  },
  {
    title: "Accès",
    links: [
      { label: "Se connecter", href: "/login" },
      { label: "Créer un compte", href: "/inscription" },
      { label: "Nous contacter", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background px-5 pb-8 pt-16 sm:px-7">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="Accueil SGNF">
              <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary p-[3px]">
                <span className="flex size-full items-center justify-center overflow-hidden rounded-[6px] bg-white">
                  <Image src="/logo-embleme.png" alt="" width={22} height={22} className="object-contain" />
                </span>
              </span>
              <span className="font-display text-[16px] font-extrabold text-foreground">SGNF</span>
            </Link>
            <p className="mt-3.5 max-w-[260px] text-[13px] leading-[1.6] text-muted-foreground">
              Système de Gestion Numérique du Foncier — plateforme nationale de gouvernance foncière de la République de
              Côte d&apos;Ivoire.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted-2">{col.title}</div>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-border pt-6">
          <span className="text-[12.5px] text-muted-2">© 2026 SGNF — République de Côte d&apos;Ivoire</span>
          <span className="text-[12.5px] text-muted-2">Tous droits réservés</span>
        </div>
      </div>
    </footer>
  );
}
