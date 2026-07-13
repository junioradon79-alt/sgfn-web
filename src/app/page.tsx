import { HomeHeader } from "@/components/home/HomeHeader";
import { PremiumHome } from "@/components/home/PremiumHome";

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[#F7F9FC] text-[#172033] antialiased">
      <HomeHeader />
      <PremiumHome />
      <footer className="border-t border-[#E3E8EF] bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-10">
          <p>© 2026 SGFN. Gestion numérique du foncier.</p>
          <div className="flex flex-wrap gap-6">
            <a href="#produit" className="transition hover:text-[#0B2E4F]">Plateforme</a>
            <a href="#securite" className="transition hover:text-[#0B2E4F]">Confiance</a>
            <a href="#faq" className="transition hover:text-[#0B2E4F]">FAQ</a>
            <a href="/contact" className="transition hover:text-[#0B2E4F]">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
