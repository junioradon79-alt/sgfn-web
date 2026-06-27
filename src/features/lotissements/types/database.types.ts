export type Database = {
  public: {
    Tables: {
      lotissements: {
        Row: {
          id: string;
          nom: string;
          commune: string | null;
          district: string | null;
          nb_lots: number | null;
          nb_ilots: number | null;
          cree_le: string;
        };
        Insert: {
          id?: string;
          nom: string;
          commune?: string | null;
          district?: string | null;
          nb_lots?: number | null;
          nb_ilots?: number | null;
          cree_le?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          commune?: string | null;
          district?: string | null;
          nb_lots?: number | null;
          nb_ilots?: number | null;
          cree_le?: string;
        };
      };
    };
  };
};