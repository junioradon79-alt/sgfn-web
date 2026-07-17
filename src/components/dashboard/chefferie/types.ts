// Types partagés entre ProprietaireTerrienView (rôles proprietaire_terrien +
// chefferie legacy avec famille) et ChefVillageView (rôle chefferie / autorité
// coutumière).

export type Profile = {
  id: string;
  nom_complet: string;
  groupe: string;
  famille_id: string | null;
  autorite_coutumiere_id: string | null;
  attributaire_id: string | null;
};

export type AttestationCoutumiere = {
  id: string;
  reference: string | null;
  numero: string | null;
  statut: string;
  date_delivrance: string | null;
  sig_chef_famille_le: string | null;
  sig_chef_village_le: string | null;
  sig_cvgfr_le: string | null;
  chef_de_famille: string | null;
};

export type PvReunion = {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_reunion: string | null;
  collectif_nom: string;
  nb_lots: number;
};
