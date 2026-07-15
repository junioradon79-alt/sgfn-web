import { HomeHeader } from "@/components/home/HomeHeader";
import { PremiumHome } from "@/components/home/PremiumHome";
import { SiteFooter } from "@/components/home/SiteFooter";

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[#F7F9FC] text-[#172033] antialiased">
      <HomeHeader />
      <PremiumHome />
      <SiteFooter />
    </div>
  );
}
