import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeContent } from "@/components/home/HomeContent";

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[#F8FAFC] text-slate-900 antialiased">
      <HomeHeader />
      <HomeContent />
      <footer className="border-t border-slate-200/40 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-10">
          <p>© 2026 SGFN. Gouvernance foncière numérique et souveraine.</p>
          <div className="flex flex-wrap gap-6">
            <a href="#apropos" className="transition hover:text-[#0D3B66]">À propos</a>
            <a href="#fonctions" className="transition hover:text-[#0D3B66]">Modules</a>
            <a href="#faq" className="transition hover:text-[#0D3B66]">FAQ</a>
            <a href="/contact" className="transition hover:text-[#0D3B66]">Contact</a>
            <a href="/login" className="transition hover:text-[#0D3B66]">Connexion</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
