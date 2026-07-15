import Image from "next/image";
import SGNFButton from "@/components/ui/SGNFButton";

export default function Hero() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-20 text-center">
        <Image
          src="/logo-officiel.png"
          alt="Logo SGNF"
          width={180}
          height={180}
          priority
        />

        <span className="mt-6 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
          Initiative privee independante
        </span>

        <h1 className="mt-8 max-w-5xl text-6xl font-extrabold leading-tight text-slate-900">
          Plateforme de gestion du foncier numerique
        </h1>

        <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-600">
          Une plateforme moderne permettant la gestion centralisee des
          lotissements, des lots, des attributions, des documents fonciers, des
          paiements et des procedures administratives.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <SGNFButton>
            Acceder a la plateforme
          </SGNFButton>

          <SGNFButton variant="secondary">
            Decouvrir SGNF
          </SGNFButton>
        </div>
      </div>
    </section>
  );
}
