"use client";

/* eslint-disable @next/next/no-img-element */
import { ShieldCheck, Workflow, Lock, ArrowRight, Store } from "lucide-react";

export function LandingScreen({
  onLogin,
  onSignup,
  onMarket,
}: {
  onLogin: () => void;
  onSignup: () => void;
  onMarket: () => void;
}) {
  return (
    <div className="sgnf-scroll absolute inset-0 flex flex-col overflow-y-auto bg-background">
      {/* Hero marque */}
      <div className="flex flex-none flex-col items-center gap-[15px] rounded-b-[30px] bg-primary px-[26px] pt-8 pb-[30px] text-center text-white">
        <div className="flex size-20 items-center justify-center rounded-[22px] bg-white shadow-[0_12px_26px_-10px_rgba(0,0,0,.45)]">
          <img src="/logo-embleme.png" alt="SGNF" className="size-16 object-contain" />
        </div>
        <div>
          <div className="text-[26px] font-extrabold tracking-[0.18em]">SGNF</div>
          <div className="mx-auto mt-1 max-w-[220px] text-[10px] font-semibold tracking-wide opacity-75">
            Système de Gestion Numérique du Foncier
          </div>
        </div>
        <div className="h-px w-10 bg-white/30" />
        <div className="max-w-[270px] text-[22px] font-extrabold leading-tight">
          Le foncier, gouverné avec précision.
        </div>
        <div className="max-w-[280px] text-[12.5px] leading-relaxed opacity-80">
          Vérifiez, suivez et sécurisez vos titres fonciers partout en Côte d&apos;Ivoire.
        </div>
      </div>

      <div className="flex flex-col gap-5 px-[22px] pt-5 pb-6">
        {/* Piliers */}
        <div className="flex gap-2.5">
          <Feature icon={ShieldCheck} label="Vérifiable" />
          <Feature icon={Workflow} label="Tracé" />
          <Feature icon={Lock} label="Sécurisé" />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onLogin}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 py-[15px] text-[15px] font-semibold text-primary-foreground shadow-panel"
          >
            Connexion à mon espace
            <ArrowRight className="size-[18px]" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onMarket}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-border-strong bg-card px-4 py-3.5 text-[14.5px] font-semibold text-foreground"
          >
            <Store className="size-[18px]" strokeWidth={1.9} />
            Explorer TerraCI Market
            <span className="size-2 rounded-full bg-terraci-gold" />
          </button>
          <button
            type="button"
            onClick={onSignup}
            className="w-full py-1.5 text-[13px] font-semibold text-accent"
          >
            Créer un compte
          </button>
        </div>

        <div className="text-center text-[10.5px] text-muted-2">République de Côte d&apos;Ivoire · SGNF</div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Lock; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-[14px] border border-border bg-card px-1 py-3.5">
      <Icon className="size-[21px] text-primary" strokeWidth={1.9} />
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
    </div>
  );
}
