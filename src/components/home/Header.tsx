import Image from "next/image";
import SGNFButton from "@/components/ui/SGNFButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Image
            src="/logo-embleme.png"
            alt="Logo SGNF"
            width={55}
            height={55}
            priority
          />

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              SGNF
            </h1>

            <p className="text-xs text-slate-500">
              Système de Gestion Numérique du Foncier
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#" className="hover:text-blue-700">
            Accueil
          </a>

          <a href="#" className="hover:text-blue-700">
            Fonctionnalités
          </a>

          <a href="#" className="hover:text-blue-700">
            À propos
          </a>

          <a href="#" className="hover:text-blue-700">
            Contact
          </a>
        </nav>

        <SGNFButton>
          Connexion
        </SGNFButton>
      </div>
    </header>
  );
}