export type Database = {
  public: {
    Tables: {
      lotissements: {
        Row: {
          id: string;
          nom: string;
          village: string | null;
          commune: string | null;
          district: string | null;
          famille_id: string | null;
          autorite_coutumiere_id: string | null;
          operateur_id: string | null;
          superficie_texte: string | null;
          superficie_m2: number | null;
          nb_ilots: number | null;
          nb_lots: number | null;
          cree_le: string;
          guide_reference: string | null;
          pv_numero_enregistrement: string | null;
          pv_commissaire_justice_id: string | null;
        };
        Insert: {
          id?: string;
          nom: string;
          village?: string | null;
          commune?: string | null;
          district?: string | null;
          superficie_texte?: string | null;
          superficie_m2?: number | null;
          nb_ilots?: number | null;
          nb_lots?: number | null;
          cree_le?: string;
          guide_reference?: string | null;
        };
        Update: {
          id?: string;
          nom?: string;
          village?: string | null;
          commune?: string | null;
          district?: string | null;
          superficie_texte?: string | null;
          superficie_m2?: number | null;
          nb_ilots?: number | null;
          nb_lots?: number | null;
          guide_reference?: string | null;
        };
      };
    };
  };
};
