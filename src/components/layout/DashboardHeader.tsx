"use client";

type Props = {
  nom: string;
};

export default function DashboardHeader({ nom }: Props) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-8 py-5">
      <div>
        <h1 className="text-2xl font-bold">
          Tableau de bord
        </h1>

        <p className="text-slate-500">
          Bienvenue {nom}
        </p>
      </div>

      <button className="rounded-lg bg-red-600 px-5 py-2 text-white">
        Déconnexion
      </button>
    </header>
  );
}