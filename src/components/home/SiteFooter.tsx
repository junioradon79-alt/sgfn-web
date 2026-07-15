import Image from "next/image";
import Link from "next/link";

type FooterLink = {
  label: string;
  href: string;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const columns: FooterColumn[] = [
  {
    title: "Plateforme",
    links: [
      { label: "Vérifier un document", href: "/verifier" },
      { label: "Passeport parcelle", href: "/passeport" },
      { label: "Gestion des lotissements", href: "/services#lotissements" },
      { label: "Gestion des parcelles", href: "/services#parcelles" },
      { label: "Coffre-fort documentaire", href: "/services#documentaire" },
      { label: "Suivi des paiements", href: "/services#paiements" },
      { label: "Dossiers ADU & ACD", href: "/services#adu" },
      { label: "Arbitrage des litiges", href: "/services#litiges" },
    ],
  },
  {
    title: "Partenaires",
    links: [
      { label: "Réseau partenaires", href: "/metiers-partenaires" },
      { label: "Devenir géomètre-expert", href: "/devenir-geometre" },
      { label: "Collectivités & chefferies", href: "/contact?profil=collectivite" },
      { label: "Aménageurs & promoteurs", href: "/contact?profil=amenageur" },
      { label: "Notaires & cabinets juridiques", href: "/contact?profil=notaire" },
      { label: "Banques & investisseurs", href: "/contact?profil=banque" },
      { label: "Agences immobilières", href: "/contact?profil=agence-immobiliere" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Comment ça marche", href: "/#produit" },
      { label: "Sécurité & confiance", href: "/#securite" },
      { label: "Questions fréquentes", href: "/#faq" },
      { label: "Guide d'achat d'un terrain", href: "/guide-achat" },
      { label: "À propos de SGFN", href: "/a-propos" },
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
    <footer className="border-t border-[#E3E8EF] bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-3" aria-label="Accueil SGFN">
              <Image src="/logo-embleme.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              <span className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGFN</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-[#526176]">
              Plateforme numérique de confiance pour le foncier en Côte d&apos;Ivoire : identification, vérification et
              sécurisation des parcelles.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#0F5E8C]">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-[#526176] transition-colors hover:text-[#0B2E4F]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[#E3E8EF] pt-6 text-sm text-[#8B98AA] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SGFN. Gestion numérique du foncier.</p>
          <p>Fait pour la Côte d&apos;Ivoire, pensé pour l&apos;Afrique de l&apos;Ouest.</p>
        </div>
      </div>
    </footer>
  );
}
