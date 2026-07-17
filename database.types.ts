export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annonces_marketplace: {
        Row: {
          cree_le: string
          description: string | null
          id: string
          lot_id: string
          maj_le: string
          prix: number
          proprietaire_profile_id: string | null
          publiee_le: string | null
          statut: string
          superficie_m2: number | null
          titre: string
          usage: string | null
          zone: string | null
        }
        Insert: {
          cree_le?: string
          description?: string | null
          id?: string
          lot_id: string
          maj_le?: string
          prix: number
          proprietaire_profile_id?: string | null
          publiee_le?: string | null
          statut?: string
          superficie_m2?: number | null
          titre: string
          usage?: string | null
          zone?: string | null
        }
        Update: {
          cree_le?: string
          description?: string | null
          id?: string
          lot_id?: string
          maj_le?: string
          prix?: number
          proprietaire_profile_id?: string | null
          publiee_le?: string | null
          statut?: string
          superficie_m2?: number | null
          titre?: string
          usage?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annonces_marketplace_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_marketplace_proprietaire_profile_id_fkey"
            columns: ["proprietaire_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attestations_cession: {
        Row: {
          acquereur_id: string
          apfc_id: string | null
          cession_id: string | null
          cree_le: string
          date_emission: string | null
          delivree_le: string | null
          id: string
          lot_id: string
          qr_token: string | null
          reference: string
          sig_chefferie_le: string | null
          sig_operateur_le: string | null
          sig_proprietaire_le: string | null
          statut: Database["public"]["Enums"]["statut_att_cession"]
        }
        Insert: {
          acquereur_id: string
          apfc_id?: string | null
          cession_id?: string | null
          cree_le?: string
          date_emission?: string | null
          delivree_le?: string | null
          id?: string
          lot_id: string
          qr_token?: string | null
          reference: string
          sig_chefferie_le?: string | null
          sig_operateur_le?: string | null
          sig_proprietaire_le?: string | null
          statut?: Database["public"]["Enums"]["statut_att_cession"]
        }
        Update: {
          acquereur_id?: string
          apfc_id?: string | null
          cession_id?: string | null
          cree_le?: string
          date_emission?: string | null
          delivree_le?: string | null
          id?: string
          lot_id?: string
          qr_token?: string | null
          reference?: string
          sig_chefferie_le?: string | null
          sig_operateur_le?: string | null
          sig_proprietaire_le?: string | null
          statut?: Database["public"]["Enums"]["statut_att_cession"]
        }
        Relationships: [
          {
            foreignKeyName: "attestations_cession_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_cession_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "attestations_cession_apfc_id_fkey"
            columns: ["apfc_id"]
            isOneToOne: false
            referencedRelation: "attestations_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_cession_cession_id_fkey"
            columns: ["cession_id"]
            isOneToOne: false
            referencedRelation: "cessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_cession_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      attestations_coutumieres: {
        Row: {
          autorite_coutumiere_id: string | null
          chef_de_famille: string | null
          cvgfr_id: string | null
          date_delivrance: string | null
          famille_id: string | null
          id: string
          lotissement_id: string | null
          non_contestation: boolean
          numero: string | null
          reference: string | null
          sig_chef_famille_le: string | null
          sig_chef_village_le: string | null
          sig_cvgfr_le: string | null
          statut: Database["public"]["Enums"]["statut_apfc"]
        }
        Insert: {
          autorite_coutumiere_id?: string | null
          chef_de_famille?: string | null
          cvgfr_id?: string | null
          date_delivrance?: string | null
          famille_id?: string | null
          id?: string
          lotissement_id?: string | null
          non_contestation?: boolean
          numero?: string | null
          reference?: string | null
          sig_chef_famille_le?: string | null
          sig_chef_village_le?: string | null
          sig_cvgfr_le?: string | null
          statut?: Database["public"]["Enums"]["statut_apfc"]
        }
        Update: {
          autorite_coutumiere_id?: string | null
          chef_de_famille?: string | null
          cvgfr_id?: string | null
          date_delivrance?: string | null
          famille_id?: string | null
          id?: string
          lotissement_id?: string | null
          non_contestation?: boolean
          numero?: string | null
          reference?: string | null
          sig_chef_famille_le?: string | null
          sig_chef_village_le?: string | null
          sig_cvgfr_le?: string | null
          statut?: Database["public"]["Enums"]["statut_apfc"]
        }
        Relationships: [
          {
            foreignKeyName: "attestations_coutumieres_autorite_coutumiere_id_fkey"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_coutumieres_cvgfr_id_fkey"
            columns: ["cvgfr_id"]
            isOneToOne: false
            referencedRelation: "cvgfr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_coutumieres_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_coutumieres_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
        ]
      }
      attributaires: {
        Row: {
          adresse: string | null
          cree_le: string
          cree_par: string | null
          email: string | null
          famille_id: string | null
          id: string
          nom: string
          piece_nature: string | null
          piece_num: string | null
          pieces_identite_url: string | null
          telephone: string | null
          type: Database["public"]["Enums"]["type_attributaire"]
        }
        Insert: {
          adresse?: string | null
          cree_le?: string
          cree_par?: string | null
          email?: string | null
          famille_id?: string | null
          id?: string
          nom: string
          piece_nature?: string | null
          piece_num?: string | null
          pieces_identite_url?: string | null
          telephone?: string | null
          type: Database["public"]["Enums"]["type_attributaire"]
        }
        Update: {
          adresse?: string | null
          cree_le?: string
          cree_par?: string | null
          email?: string | null
          famille_id?: string | null
          id?: string
          nom?: string
          piece_nature?: string | null
          piece_num?: string | null
          pieces_identite_url?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["type_attributaire"]
        }
        Relationships: [
          {
            foreignKeyName: "attributaires_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributaires_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          actuel: boolean
          attributaire_id: string
          depuis: string | null
          enterine: boolean
          enterine_le: string | null
          enterine_par: string | null
          id: string
          lot_id: string
          observation: string | null
          operateur_id: string | null
          qualite: Database["public"]["Enums"]["qualite_attribution"]
          rang: number
        }
        Insert: {
          actuel?: boolean
          attributaire_id: string
          depuis?: string | null
          enterine?: boolean
          enterine_le?: string | null
          enterine_par?: string | null
          id?: string
          lot_id: string
          observation?: string | null
          operateur_id?: string | null
          qualite: Database["public"]["Enums"]["qualite_attribution"]
          rang?: number
        }
        Update: {
          actuel?: boolean
          attributaire_id?: string
          depuis?: string | null
          enterine?: boolean
          enterine_le?: string | null
          enterine_par?: string | null
          id?: string
          lot_id?: string
          observation?: string | null
          operateur_id?: string | null
          qualite?: Database["public"]["Enums"]["qualite_attribution"]
          rang?: number
        }
        Relationships: [
          {
            foreignKeyName: "attributions_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "attributions_enterine_par_fkey"
            columns: ["enterine_par"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_operateur_id_fkey"
            columns: ["operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      autorites_coutumieres: {
        Row: {
          chef: string | null
          contact: string | null
          id: string
          nom: string
          type: string | null
          village: string | null
        }
        Insert: {
          chef?: string | null
          contact?: string | null
          id?: string
          nom: string
          type?: string | null
          village?: string | null
        }
        Update: {
          chef?: string | null
          contact?: string | null
          id?: string
          nom?: string
          type?: string | null
          village?: string | null
        }
        Relationships: []
      }
      certificats_vente: {
        Row: {
          acquereur_id: string
          cree_le: string
          date_emission: string | null
          id: string
          lot_id: string
          qr_token: string | null
          reference: string
          sig_acquereur_le: string | null
          sig_sgfn_le: string | null
          sig_vendeur_le: string | null
          statut: Database["public"]["Enums"]["statut_certificat_vente"]
          vente_id: string | null
        }
        Insert: {
          acquereur_id: string
          cree_le?: string
          date_emission?: string | null
          id?: string
          lot_id: string
          qr_token?: string | null
          reference: string
          sig_acquereur_le?: string | null
          sig_sgfn_le?: string | null
          sig_vendeur_le?: string | null
          statut?: Database["public"]["Enums"]["statut_certificat_vente"]
          vente_id?: string | null
        }
        Update: {
          acquereur_id?: string
          cree_le?: string
          date_emission?: string | null
          id?: string
          lot_id?: string
          qr_token?: string | null
          reference?: string
          sig_acquereur_le?: string | null
          sig_sgfn_le?: string | null
          sig_vendeur_le?: string | null
          statut?: Database["public"]["Enums"]["statut_certificat_vente"]
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificats_vente_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificats_vente_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "certificats_vente_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificats_vente_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      cessions: {
        Row: {
          acquereur_id: string
          date_cession: string | null
          id: string
          lot_id: string
          montant_attestation: number | null
          observation: string | null
          operateur_id: string | null
          statut: Database["public"]["Enums"]["statut_cession"]
        }
        Insert: {
          acquereur_id: string
          date_cession?: string | null
          id?: string
          lot_id: string
          montant_attestation?: number | null
          observation?: string | null
          operateur_id?: string | null
          statut?: Database["public"]["Enums"]["statut_cession"]
        }
        Update: {
          acquereur_id?: string
          date_cession?: string | null
          id?: string
          lot_id?: string
          montant_attestation?: number | null
          observation?: string | null
          operateur_id?: string | null
          statut?: Database["public"]["Enums"]["statut_cession"]
        }
        Relationships: [
          {
            foreignKeyName: "cessions_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessions_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "cessions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cessions_operateur_id_fkey"
            columns: ["operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      commissaires_justice: {
        Row: {
          contact: string | null
          etude: string | null
          id: string
          nom: string
          ressort: string | null
        }
        Insert: {
          contact?: string | null
          etude?: string | null
          id?: string
          nom: string
          ressort?: string | null
        }
        Update: {
          contact?: string | null
          etude?: string | null
          id?: string
          nom?: string
          ressort?: string | null
        }
        Relationships: []
      }
      constats: {
        Row: {
          commissaire_id: string | null
          cree_le: string
          cree_par: string | null
          date_constat: string
          document_id: string | null
          id: string
          litige_id: string | null
          lot_id: string | null
          objet: string
          observations: string | null
          reference: string | null
          type: Database["public"]["Enums"]["type_constat"]
        }
        Insert: {
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string | null
          date_constat?: string
          document_id?: string | null
          id?: string
          litige_id?: string | null
          lot_id?: string | null
          objet: string
          observations?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["type_constat"]
        }
        Update: {
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string | null
          date_constat?: string
          document_id?: string | null
          id?: string
          litige_id?: string | null
          lot_id?: string | null
          objet?: string
          observations?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["type_constat"]
        }
        Relationships: [
          {
            foreignKeyName: "constats_commissaire_id_fkey"
            columns: ["commissaire_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constats_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constats_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constats_litige_id_fkey"
            columns: ["litige_id"]
            isOneToOne: false
            referencedRelation: "litiges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constats_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations_qr: {
        Row: {
          code: string
          commission_sgnf: number
          cree_le: string
          id: string
          jeton: string
          montant_total: number
          part_chefferie: number
          payee_le: string | null
          reference_document: string
          reference_externe: string | null
          reference_saisie: string
          statut: string
          type_document: string
        }
        Insert: {
          code: string
          commission_sgnf?: number
          cree_le?: string
          id?: string
          jeton: string
          montant_total?: number
          part_chefferie?: number
          payee_le?: string | null
          reference_document: string
          reference_externe?: string | null
          reference_saisie: string
          statut?: string
          type_document?: string
        }
        Update: {
          code?: string
          commission_sgnf?: number
          cree_le?: string
          id?: string
          jeton?: string
          montant_total?: number
          part_chefferie?: number
          payee_le?: string | null
          reference_document?: string
          reference_externe?: string | null
          reference_saisie?: string
          statut?: string
          type_document?: string
        }
        Relationships: []
      }
      conversation_documents: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          nom_fichier: string
          storage_path: string
          taille_octets: number | null
          type_mime: string | null
          uploaded_by: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          nom_fichier: string
          storage_path: string
          taille_octets?: number | null
          type_mime?: string | null
          uploaded_by?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          nom_fichier?: string
          storage_path?: string
          taille_octets?: number | null
          type_mime?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_documents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          profile_id: string
        }
        Insert: {
          conversation_id: string
          profile_id: string
        }
        Update: {
          conversation_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cree_le: string
          cree_par: string | null
          demarche_id: string | null
          id: string
          litige_id: string | null
          lot_id: string | null
          lotissement_id: string | null
          sujet: string | null
          type: string
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          demarche_id?: string | null
          id?: string
          litige_id?: string | null
          lot_id?: string | null
          lotissement_id?: string | null
          sujet?: string | null
          type?: string
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          demarche_id?: string | null
          id?: string
          litige_id?: string | null
          lot_id?: string | null
          lotissement_id?: string | null
          sujet?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_demarche_id_fkey"
            columns: ["demarche_id"]
            isOneToOne: false
            referencedRelation: "demarches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_litige_id_fkey"
            columns: ["litige_id"]
            isOneToOne: false
            referencedRelation: "litiges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
        ]
      }
      cvgfr: {
        Row: {
          contact: string | null
          id: string
          lotissement_id: string | null
          president: string | null
          village: string | null
        }
        Insert: {
          contact?: string | null
          id?: string
          lotissement_id?: string | null
          president?: string | null
          village?: string | null
        }
        Update: {
          contact?: string | null
          id?: string
          lotissement_id?: string | null
          president?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cvgfr_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_acquisition: {
        Row: {
          acquereur_nom: string
          acquereur_telephone: string | null
          attributaire_id: string | null
          cession_id: string | null
          conversation_id: string | null
          cree_le: string
          demandeur_profile_id: string
          id: string
          lot_id: string
          maj_le: string
          message: string | null
          montant_propose: number | null
          note_agence: string | null
          statut: Database["public"]["Enums"]["statut_demande_acquisition"]
          traite_par: string | null
          vente_id: string | null
        }
        Insert: {
          acquereur_nom: string
          acquereur_telephone?: string | null
          attributaire_id?: string | null
          cession_id?: string | null
          conversation_id?: string | null
          cree_le?: string
          demandeur_profile_id: string
          id?: string
          lot_id: string
          maj_le?: string
          message?: string | null
          montant_propose?: number | null
          note_agence?: string | null
          statut?: Database["public"]["Enums"]["statut_demande_acquisition"]
          traite_par?: string | null
          vente_id?: string | null
        }
        Update: {
          acquereur_nom?: string
          acquereur_telephone?: string | null
          attributaire_id?: string | null
          cession_id?: string | null
          conversation_id?: string | null
          cree_le?: string
          demandeur_profile_id?: string
          id?: string
          lot_id?: string
          maj_le?: string
          message?: string | null
          montant_propose?: number | null
          note_agence?: string | null
          statut?: Database["public"]["Enums"]["statut_demande_acquisition"]
          traite_par?: string | null
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_acquisition_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "demandes_acquisition_cession_id_fkey"
            columns: ["cession_id"]
            isOneToOne: false
            referencedRelation: "cessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_demandeur_profile_id_fkey"
            columns: ["demandeur_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_contact: {
        Row: {
          annonce_id: string
          cree_le: string
          id: string
          jeton_id: string
          message: string | null
          statut: string
        }
        Insert: {
          annonce_id: string
          cree_le?: string
          id?: string
          jeton_id: string
          message?: string | null
          statut?: string
        }
        Update: {
          annonce_id?: string
          cree_le?: string
          id?: string
          jeton_id?: string
          message?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_contact_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_contact_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_contact_jeton_id_fkey"
            columns: ["jeton_id"]
            isOneToOne: false
            referencedRelation: "jetons_marketplace"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_inscription_geometre: {
        Row: {
          cabinet: string | null
          cree_le: string
          email: string | null
          id: string
          invitation_id: string | null
          message: string | null
          nom: string
          numero_ordre: string | null
          statut: string
          telephone: string
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          cabinet?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          invitation_id?: string | null
          message?: string | null
          nom: string
          numero_ordre?: string | null
          statut?: string
          telephone: string
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          cabinet?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          invitation_id?: string | null
          message?: string | null
          nom?: string
          numero_ordre?: string | null
          statut?: string
          telephone?: string
          traite_le?: string | null
          traite_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_inscription_geometre_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_inscription_geometre_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demarches: {
        Row: {
          agent_assigne: string | null
          attributaire_id: string | null
          cree_par: string | null
          description: string | null
          id: string
          lot_id: string
          montant_honoraires: number | null
          ouverte_le: string
          statut: Database["public"]["Enums"]["statut_demarche"]
          terminee_le: string | null
          type: Database["public"]["Enums"]["type_demarche"]
        }
        Insert: {
          agent_assigne?: string | null
          attributaire_id?: string | null
          cree_par?: string | null
          description?: string | null
          id?: string
          lot_id: string
          montant_honoraires?: number | null
          ouverte_le?: string
          statut?: Database["public"]["Enums"]["statut_demarche"]
          terminee_le?: string | null
          type: Database["public"]["Enums"]["type_demarche"]
        }
        Update: {
          agent_assigne?: string | null
          attributaire_id?: string | null
          cree_par?: string | null
          description?: string | null
          id?: string
          lot_id?: string
          montant_honoraires?: number | null
          ouverte_le?: string
          statut?: Database["public"]["Enums"]["statut_demarche"]
          terminee_le?: string | null
          type?: Database["public"]["Enums"]["type_demarche"]
        }
        Relationships: [
          {
            foreignKeyName: "demarches_agent_assigne_fkey"
            columns: ["agent_assigne"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demarches_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demarches_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "demarches_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demarches_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          apercu_url: string | null
          date_document: string | null
          emetteur: string | null
          hash_fichier: string | null
          id: string
          lot_id: string | null
          televerse_le: string
          televerse_par: string | null
          titre: string | null
          type: Database["public"]["Enums"]["type_document"]
          url_fichier: string
        }
        Insert: {
          apercu_url?: string | null
          date_document?: string | null
          emetteur?: string | null
          hash_fichier?: string | null
          id?: string
          lot_id?: string | null
          televerse_le?: string
          televerse_par?: string | null
          titre?: string | null
          type: Database["public"]["Enums"]["type_document"]
          url_fichier: string
        }
        Update: {
          apercu_url?: string | null
          date_document?: string | null
          emetteur?: string | null
          hash_fichier?: string | null
          id?: string
          lot_id?: string | null
          televerse_le?: string
          televerse_par?: string | null
          titre?: string | null
          type?: Database["public"]["Enums"]["type_document"]
          url_fichier?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_televerse_par_fkey"
            columns: ["televerse_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers_adu: {
        Row: {
          acd_date: string | null
          acd_reference: string | null
          adu_date: string | null
          adu_numero: string | null
          apfc_id: string | null
          commissaire_id: string | null
          cree_le: string
          cree_par: string | null
          cvgfr_id: string | null
          demandeur_id: string | null
          depose_le: string | null
          doc_apfc_id: string | null
          doc_certificat_residence_id: string | null
          doc_non_contestation_id: string | null
          doc_plan_localisation_id: string | null
          doc_pv_constatation_id: string | null
          geometre_id: string | null
          id: string
          lot_id: string
          notes: string | null
          piece_identite_ok: boolean
          statut: Database["public"]["Enums"]["statut_dossier_adu"]
        }
        Insert: {
          acd_date?: string | null
          acd_reference?: string | null
          adu_date?: string | null
          adu_numero?: string | null
          apfc_id?: string | null
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string | null
          cvgfr_id?: string | null
          demandeur_id?: string | null
          depose_le?: string | null
          doc_apfc_id?: string | null
          doc_certificat_residence_id?: string | null
          doc_non_contestation_id?: string | null
          doc_plan_localisation_id?: string | null
          doc_pv_constatation_id?: string | null
          geometre_id?: string | null
          id?: string
          lot_id: string
          notes?: string | null
          piece_identite_ok?: boolean
          statut?: Database["public"]["Enums"]["statut_dossier_adu"]
        }
        Update: {
          acd_date?: string | null
          acd_reference?: string | null
          adu_date?: string | null
          adu_numero?: string | null
          apfc_id?: string | null
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string | null
          cvgfr_id?: string | null
          demandeur_id?: string | null
          depose_le?: string | null
          doc_apfc_id?: string | null
          doc_certificat_residence_id?: string | null
          doc_non_contestation_id?: string | null
          doc_plan_localisation_id?: string | null
          doc_pv_constatation_id?: string | null
          geometre_id?: string | null
          id?: string
          lot_id?: string
          notes?: string | null
          piece_identite_ok?: boolean
          statut?: Database["public"]["Enums"]["statut_dossier_adu"]
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_adu_apfc_id_fkey"
            columns: ["apfc_id"]
            isOneToOne: false
            referencedRelation: "attestations_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_commissaire_id_fkey"
            columns: ["commissaire_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_cvgfr_id_fkey"
            columns: ["cvgfr_id"]
            isOneToOne: false
            referencedRelation: "cvgfr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "dossiers_adu_doc_apfc_id_fkey"
            columns: ["doc_apfc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_doc_certificat_residence_id_fkey"
            columns: ["doc_certificat_residence_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_doc_non_contestation_id_fkey"
            columns: ["doc_non_contestation_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_doc_plan_localisation_id_fkey"
            columns: ["doc_plan_localisation_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_doc_pv_constatation_id_fkey"
            columns: ["doc_pv_constatation_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_geometre_id_fkey"
            columns: ["geometre_id"]
            isOneToOne: false
            referencedRelation: "geometres_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_adu_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      echeances: {
        Row: {
          date_echeance: string
          id: string
          montant_du: number
          montant_paye: number
          numero: number
          paye_le: string | null
          statut: Database["public"]["Enums"]["statut_echeance"]
          vente_id: string
        }
        Insert: {
          date_echeance: string
          id?: string
          montant_du: number
          montant_paye?: number
          numero: number
          paye_le?: string | null
          statut?: Database["public"]["Enums"]["statut_echeance"]
          vente_id: string
        }
        Update: {
          date_echeance?: string
          id?: string
          montant_du?: number
          montant_paye?: number
          numero?: number
          paye_le?: string | null
          statut?: Database["public"]["Enums"]["statut_echeance"]
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "echeances_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      familles: {
        Row: {
          attributaire_id: string | null
          chef_de_famille: string | null
          chef_profile_id: string | null
          contact: string | null
          grande_famille_id: string | null
          id: string
          lignee_id: string | null
          nom: string
        }
        Insert: {
          attributaire_id?: string | null
          chef_de_famille?: string | null
          chef_profile_id?: string | null
          contact?: string | null
          grande_famille_id?: string | null
          id?: string
          lignee_id?: string | null
          nom: string
        }
        Update: {
          attributaire_id?: string | null
          chef_de_famille?: string | null
          chef_profile_id?: string | null
          contact?: string | null
          grande_famille_id?: string | null
          id?: string
          lignee_id?: string | null
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "familles_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familles_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "familles_chef_profile_id_fkey"
            columns: ["chef_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familles_grande_famille_id_fkey"
            columns: ["grande_famille_id"]
            isOneToOne: false
            referencedRelation: "grandes_familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familles_lignee_id_fkey"
            columns: ["lignee_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      geometres_experts: {
        Row: {
          cabinet: string | null
          contact: string | null
          id: string
          nom: string
          numero_ordre: string | null
        }
        Insert: {
          cabinet?: string | null
          contact?: string | null
          id?: string
          nom: string
          numero_ordre?: string | null
        }
        Update: {
          cabinet?: string | null
          contact?: string | null
          id?: string
          nom?: string
          numero_ordre?: string | null
        }
        Relationships: []
      }
      grandes_familles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      grille_commissions: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          mode: string
          montant_max: number | null
          montant_min: number
          type_paiement: Database["public"]["Enums"]["type_paiement"] | null
          valeur: number
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id?: string
          mode: string
          montant_max?: number | null
          montant_min?: number
          type_paiement?: Database["public"]["Enums"]["type_paiement"] | null
          valeur: number
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          mode?: string
          montant_max?: number | null
          montant_min?: number
          type_paiement?: Database["public"]["Enums"]["type_paiement"] | null
          valeur?: number
        }
        Relationships: []
      }
      ilots: {
        Row: {
          id: string
          lotissement_id: string
          numero: string
        }
        Insert: {
          id?: string
          lotissement_id: string
          numero: string
        }
        Update: {
          id?: string
          lotissement_id?: string
          numero?: string
        }
        Relationships: [
          {
            foreignKeyName: "ilots_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          attributaire_id: string | null
          autorite_coutumiere_id: string | null
          code: string
          commissaire_id: string | null
          cree_le: string
          cree_par: string
          email: string | null
          expire_le: string
          famille_id: string | null
          geometre_id: string | null
          groupe: Database["public"]["Enums"]["groupe_utilisateur"]
          id: string
          nom_complet: string | null
          statut: string
          telephone: string | null
          utilisee_le: string | null
          utilisee_par: string | null
        }
        Insert: {
          attributaire_id?: string | null
          autorite_coutumiere_id?: string | null
          code?: string
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string
          email?: string | null
          expire_le?: string
          famille_id?: string | null
          geometre_id?: string | null
          groupe: Database["public"]["Enums"]["groupe_utilisateur"]
          id?: string
          nom_complet?: string | null
          statut?: string
          telephone?: string | null
          utilisee_le?: string | null
          utilisee_par?: string | null
        }
        Update: {
          attributaire_id?: string | null
          autorite_coutumiere_id?: string | null
          code?: string
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string
          email?: string | null
          expire_le?: string
          famille_id?: string | null
          geometre_id?: string | null
          groupe?: Database["public"]["Enums"]["groupe_utilisateur"]
          id?: string
          nom_complet?: string | null
          statut?: string
          telephone?: string | null
          utilisee_le?: string | null
          utilisee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "invitations_autorite_coutumiere_id_fkey"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_commissaire_id_fkey"
            columns: ["commissaire_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_geometre_id_fkey"
            columns: ["geometre_id"]
            isOneToOne: false
            referencedRelation: "geometres_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      jetons_marketplace: {
        Row: {
          acheteur_email: string | null
          acheteur_nom: string | null
          acheteur_profile_id: string | null
          acheteur_telephone: string
          contacts_max: number
          contacts_utilises: number
          cree_le: string
          date_activation: string | null
          date_expiration: string | null
          id: string
          montant: number
          paiement_id: string | null
          reference: string
          statut: string
        }
        Insert: {
          acheteur_email?: string | null
          acheteur_nom?: string | null
          acheteur_profile_id?: string | null
          acheteur_telephone: string
          contacts_max?: number
          contacts_utilises?: number
          cree_le?: string
          date_activation?: string | null
          date_expiration?: string | null
          id?: string
          montant?: number
          paiement_id?: string | null
          reference?: string
          statut?: string
        }
        Update: {
          acheteur_email?: string | null
          acheteur_nom?: string | null
          acheteur_profile_id?: string | null
          acheteur_telephone?: string
          contacts_max?: number
          contacts_utilises?: number
          cree_le?: string
          date_activation?: string | null
          date_expiration?: string | null
          id?: string
          montant?: number
          paiement_id?: string | null
          reference?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "jetons_marketplace_acheteur_profile_id_fkey"
            columns: ["acheteur_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jetons_marketplace_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "demandes_acquisition_agence"
            referencedColumns: ["vente_paiement_id"]
          },
          {
            foreignKeyName: "jetons_marketplace_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_audit: {
        Row: {
          action: string
          ancienne_valeur: Json | null
          effectue_le: string
          effectue_par: string | null
          enregistrement_id: string | null
          id: number
          nouvelle_valeur: Json | null
          table_concernee: string
        }
        Insert: {
          action: string
          ancienne_valeur?: Json | null
          effectue_le?: string
          effectue_par?: string | null
          enregistrement_id?: string | null
          id?: never
          nouvelle_valeur?: Json | null
          table_concernee: string
        }
        Update: {
          action?: string
          ancienne_valeur?: Json | null
          effectue_le?: string
          effectue_par?: string | null
          enregistrement_id?: string | null
          id?: never
          nouvelle_valeur?: Json | null
          table_concernee?: string
        }
        Relationships: []
      }
      litiges: {
        Row: {
          clos_le: string | null
          commissaire_id: string | null
          cree_par: string | null
          id: string
          lot_id: string
          notes: string | null
          objet: string
          ouvert_le: string
          statut: Database["public"]["Enums"]["statut_litige"]
        }
        Insert: {
          clos_le?: string | null
          commissaire_id?: string | null
          cree_par?: string | null
          id?: string
          lot_id: string
          notes?: string | null
          objet: string
          ouvert_le?: string
          statut?: Database["public"]["Enums"]["statut_litige"]
        }
        Update: {
          clos_le?: string | null
          commissaire_id?: string | null
          cree_par?: string | null
          id?: string
          lot_id?: string
          notes?: string | null
          objet?: string
          ouvert_le?: string
          statut?: Database["public"]["Enums"]["statut_litige"]
        }
        Relationships: [
          {
            foreignKeyName: "litiges_commissaire_id_fkey"
            columns: ["commissaire_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litiges_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litiges_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      litiges_suivi: {
        Row: {
          auteur_id: string | null
          corps: string | null
          cree_le: string
          id: string
          litige_id: string
          statut_apres: string | null
          statut_avant: string | null
          type: string
        }
        Insert: {
          auteur_id?: string | null
          corps?: string | null
          cree_le?: string
          id?: string
          litige_id: string
          statut_apres?: string | null
          statut_avant?: string | null
          type?: string
        }
        Update: {
          auteur_id?: string | null
          corps?: string | null
          cree_le?: string
          id?: string
          litige_id?: string
          statut_apres?: string | null
          statut_avant?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "litiges_suivi_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litiges_suivi_litige_id_fkey"
            columns: ["litige_id"]
            isOneToOne: false
            referencedRelation: "litiges"
            referencedColumns: ["id"]
          },
        ]
      }
      lotissements: {
        Row: {
          autorite_coutumiere_id: string | null
          beneficiaire_immatriculation: string | null
          cabinet_geometre: string | null
          cedant: string | null
          centre_cadastral: string | null
          commune: string | null
          cree_le: string
          date_leve_topographique: string | null
          district: string | null
          famille_id: string | null
          geometre_expert: string | null
          guide_reference: string | null
          id: string
          latitude: number | null
          livre_foncier: string | null
          longitude: number | null
          nb_bornes: number | null
          nb_ilots: number | null
          nb_lots: number | null
          nom: string
          operateur_id: string | null
          pdfmonkey_template_attestation_cession: string | null
          pv_commissaire_justice_id: string | null
          pv_identification_physique_date: string | null
          pv_identification_physique_numero: string | null
          pv_identification_physique_scan_url: string | null
          pv_numero_enregistrement: string | null
          reference_plan: string | null
          superficie_m2: number | null
          superficie_texte: string | null
          tf_numero: string | null
          village: string | null
        }
        Insert: {
          autorite_coutumiere_id?: string | null
          beneficiaire_immatriculation?: string | null
          cabinet_geometre?: string | null
          cedant?: string | null
          centre_cadastral?: string | null
          commune?: string | null
          cree_le?: string
          date_leve_topographique?: string | null
          district?: string | null
          famille_id?: string | null
          geometre_expert?: string | null
          guide_reference?: string | null
          id?: string
          latitude?: number | null
          livre_foncier?: string | null
          longitude?: number | null
          nb_bornes?: number | null
          nb_ilots?: number | null
          nb_lots?: number | null
          nom: string
          operateur_id?: string | null
          pdfmonkey_template_attestation_cession?: string | null
          pv_commissaire_justice_id?: string | null
          pv_identification_physique_date?: string | null
          pv_identification_physique_numero?: string | null
          pv_identification_physique_scan_url?: string | null
          pv_numero_enregistrement?: string | null
          reference_plan?: string | null
          superficie_m2?: number | null
          superficie_texte?: string | null
          tf_numero?: string | null
          village?: string | null
        }
        Update: {
          autorite_coutumiere_id?: string | null
          beneficiaire_immatriculation?: string | null
          cabinet_geometre?: string | null
          cedant?: string | null
          centre_cadastral?: string | null
          commune?: string | null
          cree_le?: string
          date_leve_topographique?: string | null
          district?: string | null
          famille_id?: string | null
          geometre_expert?: string | null
          guide_reference?: string | null
          id?: string
          latitude?: number | null
          livre_foncier?: string | null
          longitude?: number | null
          nb_bornes?: number | null
          nb_ilots?: number | null
          nb_lots?: number | null
          nom?: string
          operateur_id?: string | null
          pdfmonkey_template_attestation_cession?: string | null
          pv_commissaire_justice_id?: string | null
          pv_identification_physique_date?: string | null
          pv_identification_physique_numero?: string | null
          pv_identification_physique_scan_url?: string | null
          pv_numero_enregistrement?: string | null
          reference_plan?: string | null
          superficie_m2?: number | null
          superficie_texte?: string | null
          tf_numero?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotissements_autorite_coutumiere_id_fkey"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotissements_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotissements_operateur_id_fkey"
            columns: ["operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotissements_pv_commissaire_justice_id_fkey"
            columns: ["pv_commissaire_justice_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          cree_le: string
          cree_par: string | null
          est_equipement: boolean
          guide_page: number | null
          id: string
          ilot_id: string
          latitude: number | null
          longitude: number | null
          nature_droit: Database["public"]["Enums"]["nature_droit"]
          numero_lot: string
          numero_parcelle: string | null
          observation: string | null
          statut: Database["public"]["Enums"]["statut_lot"]
          superficie_m2: number | null
          verrouille: boolean
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          est_equipement?: boolean
          guide_page?: number | null
          id?: string
          ilot_id: string
          latitude?: number | null
          longitude?: number | null
          nature_droit?: Database["public"]["Enums"]["nature_droit"]
          numero_lot: string
          numero_parcelle?: string | null
          observation?: string | null
          statut?: Database["public"]["Enums"]["statut_lot"]
          superficie_m2?: number | null
          verrouille?: boolean
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          est_equipement?: boolean
          guide_page?: number | null
          id?: string
          ilot_id?: string
          latitude?: number | null
          longitude?: number | null
          nature_droit?: Database["public"]["Enums"]["nature_droit"]
          numero_lot?: string
          numero_parcelle?: string | null
          observation?: string | null
          statut?: Database["public"]["Enums"]["statut_lot"]
          superficie_m2?: number | null
          verrouille?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lots_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_ilot_id_fkey"
            columns: ["ilot_id"]
            isOneToOne: false
            referencedRelation: "ilots"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_etat_site: {
        Row: {
          derniere_reconstruction: string | null
          id: boolean
          reconstruit_par: string | null
        }
        Insert: {
          derniere_reconstruction?: string | null
          id?: boolean
          reconstruit_par?: string | null
        }
        Update: {
          derniere_reconstruction?: string | null
          id?: boolean
          reconstruit_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_etat_site_reconstruit_par_fkey"
            columns: ["reconstruit_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          corps: string
          envoye_le: string
          expediteur: string
          id: string
          lu: boolean
        }
        Insert: {
          conversation_id: string
          corps: string
          envoye_le?: string
          expediteur: string
          id?: string
          lu?: boolean
        }
        Update: {
          conversation_id?: string
          corps?: string
          envoye_le?: string
          expediteur?: string
          id?: string
          lu?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_expediteur_fkey"
            columns: ["expediteur"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions_geometre: {
        Row: {
          client_contact: string | null
          client_nom: string
          cree_le: string
          cree_par: string | null
          description: string | null
          geometre_id: string
          id: string
          lieu: string | null
          lot_id: string | null
          montant_honoraires: number | null
          montant_recu: number | null
          ouverte_le: string
          statut: Database["public"]["Enums"]["statut_mission_geometre"]
          terminee_le: string | null
          type_mission: Database["public"]["Enums"]["type_mission_geometre"]
        }
        Insert: {
          client_contact?: string | null
          client_nom: string
          cree_le?: string
          cree_par?: string | null
          description?: string | null
          geometre_id: string
          id?: string
          lieu?: string | null
          lot_id?: string | null
          montant_honoraires?: number | null
          montant_recu?: number | null
          ouverte_le?: string
          statut?: Database["public"]["Enums"]["statut_mission_geometre"]
          terminee_le?: string | null
          type_mission: Database["public"]["Enums"]["type_mission_geometre"]
        }
        Update: {
          client_contact?: string | null
          client_nom?: string
          cree_le?: string
          cree_par?: string | null
          description?: string | null
          geometre_id?: string
          id?: string
          lieu?: string | null
          lot_id?: string | null
          montant_honoraires?: number | null
          montant_recu?: number | null
          ouverte_le?: string
          statut?: Database["public"]["Enums"]["statut_mission_geometre"]
          terminee_le?: string | null
          type_mission?: Database["public"]["Enums"]["type_mission_geometre"]
        }
        Relationships: [
          {
            foreignKeyName: "missions_geometre_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_geometre_geometre_id_fkey"
            columns: ["geometre_id"]
            isOneToOne: false
            referencedRelation: "geometres_experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_geometre_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          canal: Database["public"]["Enums"]["canal_notification"]
          cree_le: string
          destinataire_profile_id: string
          envoye_le: string | null
          erreur: string | null
          id: string
          params: Json
          reference_id: string | null
          reference_table: string | null
          statut: Database["public"]["Enums"]["statut_notification"]
          type: string
        }
        Insert: {
          canal?: Database["public"]["Enums"]["canal_notification"]
          cree_le?: string
          destinataire_profile_id: string
          envoye_le?: string | null
          erreur?: string | null
          id?: string
          params?: Json
          reference_id?: string | null
          reference_table?: string | null
          statut?: Database["public"]["Enums"]["statut_notification"]
          type: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_notification"]
          cree_le?: string
          destinataire_profile_id?: string
          envoye_le?: string | null
          erreur?: string | null
          id?: string
          params?: Json
          reference_id?: string | null
          reference_table?: string | null
          statut?: Database["public"]["Enums"]["statut_notification"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_destinataire_profile_id_fkey"
            columns: ["destinataire_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_a_envoyer: {
        Row: {
          canal: string
          contenu: string
          cree_le: string
          destinataire_id: string
          envoyee_le: string | null
          erreur: string | null
          id: string
          message_id: string | null
          statut: string
          sujet: string | null
        }
        Insert: {
          canal: string
          contenu: string
          cree_le?: string
          destinataire_id: string
          envoyee_le?: string | null
          erreur?: string | null
          id?: string
          message_id?: string | null
          statut?: string
          sujet?: string | null
        }
        Update: {
          canal?: string
          contenu?: string
          cree_le?: string
          destinataire_id?: string
          envoyee_le?: string | null
          erreur?: string | null
          id?: string
          message_id?: string | null
          statut?: string
          sujet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_a_envoyer_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_a_envoyer_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      operateurs: {
        Row: {
          contact: string | null
          id: string
          nom: string
          type: string | null
        }
        Insert: {
          contact?: string | null
          id?: string
          nom: string
          type?: string | null
        }
        Update: {
          contact?: string | null
          id?: string
          nom?: string
          type?: string | null
        }
        Relationships: []
      }
      paiements: {
        Row: {
          acquereur_id: string | null
          beneficiaire: string | null
          cession_id: string | null
          commission_sgfn: number
          confirme_le: string | null
          cree_le: string
          demarche_id: string | null
          echeance_id: string | null
          frais_agregateur: number
          id: string
          montant_reverse: number | null
          montant_total: number
          moyen: Database["public"]["Enums"]["moyen_paiement"] | null
          reference: string | null
          reference_externe: string | null
          statut: Database["public"]["Enums"]["statut_paiement"]
          type: Database["public"]["Enums"]["type_paiement"]
          valide_le: string | null
          valide_par: string | null
          vente_id: string | null
        }
        Insert: {
          acquereur_id?: string | null
          beneficiaire?: string | null
          cession_id?: string | null
          commission_sgfn?: number
          confirme_le?: string | null
          cree_le?: string
          demarche_id?: string | null
          echeance_id?: string | null
          frais_agregateur?: number
          id?: string
          montant_reverse?: number | null
          montant_total: number
          moyen?: Database["public"]["Enums"]["moyen_paiement"] | null
          reference?: string | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          type?: Database["public"]["Enums"]["type_paiement"]
          valide_le?: string | null
          valide_par?: string | null
          vente_id?: string | null
        }
        Update: {
          acquereur_id?: string | null
          beneficiaire?: string | null
          cession_id?: string | null
          commission_sgfn?: number
          confirme_le?: string | null
          cree_le?: string
          demarche_id?: string | null
          echeance_id?: string | null
          frais_agregateur?: number
          id?: string
          montant_reverse?: number | null
          montant_total?: number
          moyen?: Database["public"]["Enums"]["moyen_paiement"] | null
          reference?: string | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          type?: Database["public"]["Enums"]["type_paiement"]
          valide_le?: string | null
          valide_par?: string | null
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "paiements_cession_id_fkey"
            columns: ["cession_id"]
            isOneToOne: false
            referencedRelation: "cessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_demarche_id_fkey"
            columns: ["demarche_id"]
            isOneToOne: false
            referencedRelation: "demarches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres_paiement: {
        Row: {
          cle: string
          description: string | null
          valeur: string
        }
        Insert: {
          cle: string
          description?: string | null
          valeur: string
        }
        Update: {
          cle?: string
          description?: string | null
          valeur?: string
        }
        Relationships: []
      }
      photos_annonces: {
        Row: {
          annonce_id: string
          chemin: string
          cree_le: string
          id: string
          ordre: number
        }
        Insert: {
          annonce_id: string
          chemin: string
          cree_le?: string
          id?: string
          ordre?: number
        }
        Update: {
          annonce_id?: string
          chemin?: string
          cree_le?: string
          id?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean
          attributaire_id: string | null
          autorite_coutumiere_id: string | null
          commissaire_id: string | null
          cree_le: string
          famille_id: string | null
          geometre_id: string | null
          groupe: Database["public"]["Enums"]["groupe_utilisateur"]
          id: string
          nom_complet: string
          operateur_id: string | null
          telephone: string | null
        }
        Insert: {
          actif?: boolean
          attributaire_id?: string | null
          autorite_coutumiere_id?: string | null
          commissaire_id?: string | null
          cree_le?: string
          famille_id?: string | null
          geometre_id?: string | null
          groupe?: Database["public"]["Enums"]["groupe_utilisateur"]
          id: string
          nom_complet: string
          operateur_id?: string | null
          telephone?: string | null
        }
        Update: {
          actif?: boolean
          attributaire_id?: string | null
          autorite_coutumiere_id?: string | null
          commissaire_id?: string | null
          cree_le?: string
          famille_id?: string | null
          geometre_id?: string | null
          groupe?: Database["public"]["Enums"]["groupe_utilisateur"]
          id?: string
          nom_complet?: string
          operateur_id?: string | null
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pr_attrib"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pr_attrib"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "fk_pr_chef"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pr_fam"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pr_oper"
            columns: ["operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_commissaire_id_fkey"
            columns: ["commissaire_id"]
            isOneToOne: false
            referencedRelation: "commissaires_justice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_geometre_id_fkey"
            columns: ["geometre_id"]
            isOneToOne: false
            referencedRelation: "geometres_experts"
            referencedColumns: ["id"]
          },
        ]
      }
      propositions_ia: {
        Row: {
          alerte: string | null
          attributaire: string | null
          cree_le: string
          demande_par: string | null
          id: string
          ilot: string | null
          lot: string | null
          lotissement_id: string | null
          observation: string | null
          qualite: string | null
          statut: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          alerte?: string | null
          attributaire?: string | null
          cree_le?: string
          demande_par?: string | null
          id?: string
          ilot?: string | null
          lot?: string | null
          lotissement_id?: string | null
          observation?: string | null
          qualite?: string | null
          statut?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          alerte?: string | null
          attributaire?: string | null
          cree_le?: string
          demande_par?: string | null
          id?: string
          ilot?: string | null
          lot?: string | null
          lotissement_id?: string | null
          observation?: string | null
          qualite?: string | null
          statut?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propositions_ia_demande_par_fkey"
            columns: ["demande_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_ia_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_ia_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_bornage: {
        Row: {
          cree_le: string
          date_bornage: string | null
          delivree_le: string | null
          id: string
          mission_id: string
          observations: string | null
          qr_token: string | null
          reference: string
          sig_autorite_le: string | null
          sig_demandeur_le: string | null
          sig_geometre_le: string | null
          statut: Database["public"]["Enums"]["statut_pv_bornage"]
          superficie_mesuree_m2: number | null
        }
        Insert: {
          cree_le?: string
          date_bornage?: string | null
          delivree_le?: string | null
          id?: string
          mission_id: string
          observations?: string | null
          qr_token?: string | null
          reference: string
          sig_autorite_le?: string | null
          sig_demandeur_le?: string | null
          sig_geometre_le?: string | null
          statut?: Database["public"]["Enums"]["statut_pv_bornage"]
          superficie_mesuree_m2?: number | null
        }
        Update: {
          cree_le?: string
          date_bornage?: string | null
          delivree_le?: string | null
          id?: string
          mission_id?: string
          observations?: string | null
          qr_token?: string | null
          reference?: string
          sig_autorite_le?: string | null
          sig_demandeur_le?: string | null
          sig_geometre_le?: string | null
          statut?: Database["public"]["Enums"]["statut_pv_bornage"]
          superficie_mesuree_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pv_bornage_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions_geometre"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_reunions_famille: {
        Row: {
          collectif_attributaire_id: string
          cree_le: string
          cree_par: string | null
          date_reunion: string | null
          document_id: string | null
          id: string
          lieu: string | null
          notes: string | null
          objet: string
          reference: string
          statut: Database["public"]["Enums"]["statut_pv_famille"]
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          collectif_attributaire_id: string
          cree_le?: string
          cree_par?: string | null
          date_reunion?: string | null
          document_id?: string | null
          id?: string
          lieu?: string | null
          notes?: string | null
          objet?: string
          reference: string
          statut?: Database["public"]["Enums"]["statut_pv_famille"]
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          collectif_attributaire_id?: string
          cree_le?: string
          cree_par?: string | null
          date_reunion?: string | null
          document_id?: string | null
          id?: string
          lieu?: string | null
          notes?: string | null
          objet?: string
          reference?: string
          statut?: Database["public"]["Enums"]["statut_pv_famille"]
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pv_reunions_famille_collectif_attributaire_id_fkey"
            columns: ["collectif_attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_collectif_attributaire_id_fkey"
            columns: ["collectif_attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_reunions_famille_lots: {
        Row: {
          lot_id: string
          pv_id: string
        }
        Insert: {
          lot_id: string
          pv_id: string
        }
        Update: {
          lot_id?: string
          pv_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_reunions_famille_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_lots_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv_reunions_famille"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_lots_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["pv_id"]
          },
        ]
      }
      pv_reunions_famille_membres: {
        Row: {
          attributaire_id: string | null
          id: string
          lien_familial: string | null
          nom: string
          present: boolean
          pv_id: string
          signataire: boolean
        }
        Insert: {
          attributaire_id?: string | null
          id?: string
          lien_familial?: string | null
          nom: string
          present?: boolean
          pv_id: string
          signataire?: boolean
        }
        Update: {
          attributaire_id?: string | null
          id?: string
          lien_familial?: string | null
          nom?: string
          present?: boolean
          pv_id?: string
          signataire?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pv_reunions_famille_membres_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_membres_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_membres_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv_reunions_famille"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_reunions_famille_membres_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["pv_id"]
          },
        ]
      }
      repartitions_paiement: {
        Row: {
          autorite_coutumiere_id: string | null
          beneficiaire_type: string
          cree_le: string
          id: string
          montant: number
          nom: string | null
          paiement_id: string
        }
        Insert: {
          autorite_coutumiere_id?: string | null
          beneficiaire_type: string
          cree_le?: string
          id?: string
          montant?: number
          nom?: string | null
          paiement_id: string
        }
        Update: {
          autorite_coutumiere_id?: string | null
          beneficiaire_type?: string
          cree_le?: string
          id?: string
          montant?: number
          nom?: string | null
          paiement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repartitions_paiement_autorite_coutumiere_id_fkey"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: false
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repartitions_paiement_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "demandes_acquisition_agence"
            referencedColumns: ["vente_paiement_id"]
          },
          {
            foreignKeyName: "repartitions_paiement_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      scans_qr: {
        Row: {
          id: string
          ip: unknown
          latitude: number | null
          longitude: number | null
          reference_saisie: string
          resultat: string
          scanne_le: string
          type_document: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip?: unknown
          latitude?: number | null
          longitude?: number | null
          reference_saisie: string
          resultat: string
          scanne_le?: string
          type_document?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip?: unknown
          latitude?: number | null
          longitude?: number | null
          reference_saisie?: string
          resultat?: string
          scanne_le?: string
          type_document?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      soumissions_saisie: {
        Row: {
          auteur_id: string
          commentaire_admin: string | null
          cree_le: string
          id: string
          lotissement_id: string | null
          maj_le: string
          payload: Json
          resultat: Json | null
          resume: Json | null
          statut: string
          titre: string | null
          traite_le: string | null
          traite_par: string | null
          type: string
        }
        Insert: {
          auteur_id: string
          commentaire_admin?: string | null
          cree_le?: string
          id?: string
          lotissement_id?: string | null
          maj_le?: string
          payload: Json
          resultat?: Json | null
          resume?: Json | null
          statut?: string
          titre?: string | null
          traite_le?: string | null
          traite_par?: string | null
          type: string
        }
        Update: {
          auteur_id?: string
          commentaire_admin?: string | null
          cree_le?: string
          id?: string
          lotissement_id?: string | null
          maj_le?: string
          payload?: Json
          resultat?: Json | null
          resume?: Json | null
          statut?: string
          titre?: string | null
          traite_le?: string | null
          traite_par?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "soumissions_saisie_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soumissions_saisie_lotissement_id_fkey"
            columns: ["lotissement_id"]
            isOneToOne: false
            referencedRelation: "lotissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soumissions_saisie_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suivis_parcelle: {
        Row: {
          cree_le: string
          id: string
          lot_id: string
          notifie_le: string | null
          profile_id: string
          reference_document: string | null
          source: string
        }
        Insert: {
          cree_le?: string
          id?: string
          lot_id: string
          notifie_le?: string | null
          profile_id: string
          reference_document?: string | null
          source?: string
        }
        Update: {
          cree_le?: string
          id?: string
          lot_id?: string
          notifie_le?: string | null
          profile_id?: string
          reference_document?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "suivis_parcelle_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivis_parcelle_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifs: {
        Row: {
          actif: boolean
          commission_max: number | null
          commission_min: number | null
          id: string
          maj_le: string
          maj_par: string | null
          montant_max: number | null
          montant_min: number | null
          notes: string | null
          type_demarche: Database["public"]["Enums"]["type_demarche"]
        }
        Insert: {
          actif?: boolean
          commission_max?: number | null
          commission_min?: number | null
          id?: string
          maj_le?: string
          maj_par?: string | null
          montant_max?: number | null
          montant_min?: number | null
          notes?: string | null
          type_demarche: Database["public"]["Enums"]["type_demarche"]
        }
        Update: {
          actif?: boolean
          commission_max?: number | null
          commission_min?: number | null
          id?: string
          maj_le?: string
          maj_par?: string | null
          montant_max?: number | null
          montant_min?: number | null
          notes?: string | null
          type_demarche?: Database["public"]["Enums"]["type_demarche"]
        }
        Relationships: []
      }
      tarifs_attestation_chefferie: {
        Row: {
          actif: boolean
          autorite_coutumiere_id: string
          commission_sgfn: number | null
          id: string
          maj_le: string
          maj_par: string | null
          montant_chefferie: number | null
          notes: string | null
        }
        Insert: {
          actif?: boolean
          autorite_coutumiere_id: string
          commission_sgfn?: number | null
          id?: string
          maj_le?: string
          maj_par?: string | null
          montant_chefferie?: number | null
          notes?: string | null
        }
        Update: {
          actif?: boolean
          autorite_coutumiere_id?: string
          commission_sgfn?: number | null
          id?: string
          maj_le?: string
          maj_par?: string | null
          montant_chefferie?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_attestation_chefferie_autorite_coutumiere_id_fkey"
            columns: ["autorite_coutumiere_id"]
            isOneToOne: true
            referencedRelation: "autorites_coutumieres"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_parties: {
        Row: {
          attributaire_id: string
          role: Database["public"]["Enums"]["role_partie"]
          transaction_id: string
        }
        Insert: {
          attributaire_id: string
          role: Database["public"]["Enums"]["role_partie"]
          transaction_id: string
        }
        Update: {
          attributaire_id?: string
          role?: Database["public"]["Enums"]["role_partie"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_parties_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_parties_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "transaction_parties_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          date_transaction: string
          devise: string | null
          enregistre_le: string
          enregistre_par: string | null
          enterine_chefferie: boolean
          id: string
          lot_id: string
          montant: number | null
          notes: string | null
          operateur_id: string | null
          type: Database["public"]["Enums"]["type_transaction"]
        }
        Insert: {
          date_transaction: string
          devise?: string | null
          enregistre_le?: string
          enregistre_par?: string | null
          enterine_chefferie?: boolean
          id?: string
          lot_id: string
          montant?: number | null
          notes?: string | null
          operateur_id?: string | null
          type: Database["public"]["Enums"]["type_transaction"]
        }
        Update: {
          date_transaction?: string
          devise?: string | null
          enregistre_le?: string
          enregistre_par?: string | null
          enterine_chefferie?: boolean
          id?: string
          lot_id?: string
          montant?: number | null
          notes?: string | null
          operateur_id?: string | null
          type?: Database["public"]["Enums"]["type_transaction"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_enregistre_par_fkey"
            columns: ["enregistre_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_operateur_id_fkey"
            columns: ["operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          acquereur_id: string
          certificat_vente_id: string | null
          cession_id: string | null
          commission_sgfn: number | null
          cree_le: string
          cree_par: string | null
          date_vente: string | null
          id: string
          lot_id: string
          montant_paye: number
          nb_echeances: number
          notes: string | null
          prix_total: number
          solde: number | null
          statut: Database["public"]["Enums"]["statut_vente"]
          taux_commission: number | null
          type_vente: Database["public"]["Enums"]["type_vente"]
          vendeur_famille_id: string | null
          vendeur_operateur_id: string | null
        }
        Insert: {
          acquereur_id: string
          certificat_vente_id?: string | null
          cession_id?: string | null
          commission_sgfn?: number | null
          cree_le?: string
          cree_par?: string | null
          date_vente?: string | null
          id?: string
          lot_id: string
          montant_paye?: number
          nb_echeances?: number
          notes?: string | null
          prix_total: number
          solde?: number | null
          statut?: Database["public"]["Enums"]["statut_vente"]
          taux_commission?: number | null
          type_vente?: Database["public"]["Enums"]["type_vente"]
          vendeur_famille_id?: string | null
          vendeur_operateur_id?: string | null
        }
        Update: {
          acquereur_id?: string
          certificat_vente_id?: string | null
          cession_id?: string | null
          commission_sgfn?: number | null
          cree_le?: string
          cree_par?: string | null
          date_vente?: string | null
          id?: string
          lot_id?: string
          montant_paye?: number
          nb_echeances?: number
          notes?: string | null
          prix_total?: number
          solde?: number | null
          statut?: Database["public"]["Enums"]["statut_vente"]
          taux_commission?: number | null
          type_vente?: Database["public"]["Enums"]["type_vente"]
          vendeur_famille_id?: string | null
          vendeur_operateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_vente_certificat"
            columns: ["certificat_vente_id"]
            isOneToOne: false
            referencedRelation: "certificats_vente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_acquereur_id_fkey"
            columns: ["acquereur_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "ventes_cession_id_fkey"
            columns: ["cession_id"]
            isOneToOne: false
            referencedRelation: "cessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_vendeur_famille_id_fkey"
            columns: ["vendeur_famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_vendeur_operateur_id_fkey"
            columns: ["vendeur_operateur_id"]
            isOneToOne: false
            referencedRelation: "operateurs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      annonces_publiques: {
        Row: {
          description: string | null
          document_type: string | null
          id: string | null
          lat_approx: number | null
          lng_approx: number | null
          lot_numero: string | null
          photo_couverture: string | null
          prix: number | null
          publiee_le: string | null
          superficie_m2: number | null
          titre: string | null
          usage: string | null
          zone: string | null
        }
        Relationships: []
      }
      demandes_acquisition_agence: {
        Row: {
          acquereur_nom: string | null
          acquereur_telephone: string | null
          attestation_qr_token: string | null
          attestation_reference: string | null
          attributaire_id: string | null
          certificat_qr_token: string | null
          certificat_reference: string | null
          cession_id: string | null
          commune: string | null
          conversation_id: string | null
          cree_le: string | null
          demandeur_nom_complet: string | null
          demandeur_profile_id: string | null
          id: string | null
          ilot_numero: string | null
          lot_id: string | null
          lotissement: string | null
          maj_le: string | null
          message: string | null
          montant_propose: number | null
          note_agence: string | null
          numero_lot: string | null
          paiement_montant: number | null
          paiement_statut: string | null
          statut:
            | Database["public"]["Enums"]["statut_demande_acquisition"]
            | null
          traite_par: string | null
          vente_id: string | null
          vente_montant_paye: number | null
          vente_paiement_id: string | null
          vente_paiement_montant: number | null
          vente_paiement_statut: string | null
          vente_prix_total: number | null
          vente_solde: number | null
          vente_statut: string | null
          vente_type: string | null
          village: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_acquisition_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "demandes_acquisition_cession_id_fkey"
            columns: ["cession_id"]
            isOneToOne: false
            referencedRelation: "cessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_demandeur_profile_id_fkey"
            columns: ["demandeur_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_acquisition_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      photos_annonces_publiques: {
        Row: {
          annonce_id: string | null
          chemin: string | null
          id: string | null
          ordre: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_marketplace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
        ]
      }
      v_attestations_gratuites_manquantes: {
        Row: {
          attributaire_id: string | null
          depuis: string | null
          lot_id: string | null
        }
        Insert: {
          attributaire_id?: string | null
          depuis?: string | null
          lot_id?: string | null
        }
        Update: {
          attributaire_id?: string | null
          depuis?: string | null
          lot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "attributaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_attributaire_id_fkey"
            columns: ["attributaire_id"]
            isOneToOne: false
            referencedRelation: "v_collectifs_pv_manquant"
            referencedColumns: ["collectif_id"]
          },
          {
            foreignKeyName: "attributions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      v_collectifs_pv_manquant: {
        Row: {
          collectif: string | null
          collectif_id: string | null
          lots_concernes: string[] | null
          pv_id: string | null
          reference: string | null
          statut: Database["public"]["Enums"]["statut_pv_famille"] | null
        }
        Relationships: []
      }
      v_dossier_adu_completude: {
        Row: {
          apfc_ok: boolean | null
          id: string | null
          lot_id: string | null
          non_contestation_ok: boolean | null
          piece_identite_ok: boolean | null
          plan_ok: boolean | null
          pret_a_deposer: boolean | null
          pv_ok: boolean | null
          statut: Database["public"]["Enums"]["statut_dossier_adu"] | null
        }
        Insert: {
          apfc_ok?: never
          id?: string | null
          lot_id?: string | null
          non_contestation_ok?: never
          piece_identite_ok?: boolean | null
          plan_ok?: never
          pret_a_deposer?: never
          pv_ok?: never
          statut?: Database["public"]["Enums"]["statut_dossier_adu"] | null
        }
        Update: {
          apfc_ok?: never
          id?: string | null
          lot_id?: string | null
          non_contestation_ok?: never
          piece_identite_ok?: boolean | null
          plan_ok?: never
          pret_a_deposer?: never
          pv_ok?: never
          statut?: Database["public"]["Enums"]["statut_dossier_adu"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_adu_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _appliquer_creation_lotissement: {
        Args: { p_payload: Json }
        Returns: Json
      }
      _appliquer_creation_structure: {
        Args: { p_payload: Json }
        Returns: Json
      }
      _appliquer_maj_attributions: { Args: { p_payload: Json }; Returns: Json }
      _appliquer_modification_lotissement: {
        Args: { p_payload: Json }
        Returns: Json
      }
      ajouter_note_litige: {
        Args: { p_corps: string; p_litige_id: string }
        Returns: string
      }
      annonce_active_pour_reference: {
        Args: { p_reference: string }
        Returns: Json
      }
      approuver_demande_geometre: { Args: { p_id: string }; Returns: Json }
      approuver_soumission: {
        Args: { p_commentaire?: string; p_id: string }
        Returns: Json
      }
      calculer_score_confiance: { Args: { p_lot_id: string }; Returns: Json }
      conformite_lotissements: { Args: never; Returns: Json }
      convertir_demande_en_cession: {
        Args: {
          p_date_cession?: string
          p_demande_id: string
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
        }
        Returns: Json
      }
      creer_attestation_gratuite_si_eligible: {
        Args: { p_attributaire_id: string; p_lot_id: string }
        Returns: undefined
      }
      creer_cession: {
        Args: {
          p_acquereur_id: string
          p_date_cession?: string
          p_lot_id: string
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
          p_observation?: string
        }
        Returns: Json
      }
      creer_demande_acquisition: {
        Args: {
          p_lot_id: string
          p_message?: string
          p_montant?: number
          p_telephone?: string
        }
        Returns: Json
      }
      creer_paiement_echeance_suivante: {
        Args: {
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
          p_vente_id: string
        }
        Returns: Json
      }
      creer_vente: {
        Args: {
          p_demande_id: string
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
          p_nb_echeances?: number
          p_prix: number
          p_type_vente?: Database["public"]["Enums"]["type_vente"]
        }
        Returns: Json
      }
      debug_mon_contexte: { Args: never; Returns: Json }
      demander_inscription_geometre: {
        Args: {
          p_cabinet?: string
          p_email?: string
          p_message?: string
          p_nom: string
          p_numero_ordre?: string
          p_telephone?: string
        }
        Returns: string
      }
      destinataires_agence_lot: {
        Args: { p_lot_id: string }
        Returns: string[]
      }
      disponibilites_foncieres: { Args: never; Returns: Json }
      encaisser_demande_acquisition: {
        Args: { p_demande_id: string }
        Returns: Json
      }
      encaisser_vente_guichet: { Args: { p_demande_id: string }; Returns: Json }
      enqueue_notification: {
        Args: {
          p_canal?: Database["public"]["Enums"]["canal_notification"]
          p_params: Json
          p_profil: string
          p_ref_id?: string
          p_ref_table?: string
          p_type: string
        }
        Returns: undefined
      }
      est_admin: { Args: never; Returns: boolean }
      est_lot_eligible_marketplace: {
        Args: { p_lot_id: string }
        Returns: boolean
      }
      facturer_attestation_cession: {
        Args: {
          p_lot_id: string
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
        }
        Returns: Json
      }
      facturer_attestation_demande: {
        Args: {
          p_demande_id: string
          p_moyen?: Database["public"]["Enums"]["moyen_paiement"]
        }
        Returns: Json
      }
      finaliser_inscription: { Args: { p_code: string }; Returns: Json }
      generer_attestations_gratuites_manquantes: { Args: never; Returns: Json }
      generer_code_invitation: { Args: never; Returns: string }
      generer_pv_bornage: {
        Args: {
          p_date_bornage: string
          p_mission_id: string
          p_observations: string
          p_superficie_mesuree_m2: number
        }
        Returns: string
      }
      get_public_stats: { Args: never; Returns: Json }
      lot_libelle: { Args: { p_lot_id: string }; Returns: Json }
      lot_pour_reference: { Args: { p_reference: string }; Returns: string }
      lots_verifiables: { Args: never; Returns: Json }
      ma_chefferie_id: { Args: never; Returns: string }
      ma_famille_attributaire_id: { Args: never; Returns: string }
      ma_famille_id: { Args: never; Returns: string }
      maj_statut_demande_acquisition: {
        Args: {
          p_demande_id: string
          p_note?: string
          p_statut: Database["public"]["Enums"]["statut_demande_acquisition"]
        }
        Returns: undefined
      }
      manifester_interet: {
        Args: { p_lot_id: string; p_message?: string }
        Returns: string
      }
      marquer_attestation_delivree: {
        Args: { p_id: string }
        Returns: undefined
      }
      marquer_echeances_en_retard: { Args: never; Returns: undefined }
      marquer_paiement_recu: {
        Args: { p_paiement_id: string; p_reference_externe?: string }
        Returns: undefined
      }
      mes_lot_ids: { Args: never; Returns: string[] }
      mes_suivis: {
        Args: never
        Returns: {
          annonce_id: string
          cree_le: string
          en_vente: boolean
          ilot_numero: string
          lot_id: string
          lotissement: string
          numero_lot: string
        }[]
      }
      mon_attributaire_id: { Args: never; Returns: string }
      mon_commissaire_id: { Args: never; Returns: string }
      mon_geometre_id: { Args: never; Returns: string }
      mon_groupe: {
        Args: never
        Returns: Database["public"]["Enums"]["groupe_utilisateur"]
      }
      mon_operateur_id: { Args: never; Returns: string }
      peut_contacter: { Args: { p_destinataire_id: string }; Returns: boolean }
      profil_de_attributaire: { Args: { p_attr: string }; Returns: string }
      regenerer_document: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      rejeter_demande_geometre: {
        Args: { p_id: string; p_motif?: string }
        Returns: undefined
      }
      rejeter_soumission: {
        Args: { p_commentaire?: string; p_id: string }
        Returns: undefined
      }
      score_confiance_lot: { Args: { p_lot_id: string }; Returns: number }
      sgfn_call_edge: {
        Args: { p_payload: Json; p_slug: string }
        Returns: undefined
      }
      soumettre_saisie: {
        Args: {
          p_lotissement_id: string
          p_payload: Json
          p_resume?: Json
          p_titre: string
          p_type: string
        }
        Returns: string
      }
      suis_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      suiveurs_de_mes_lots: {
        Args: never
        Returns: {
          lot_id: string
          nb_suiveurs: number
        }[]
      }
      suivre_parcelle: { Args: { p_reference: string }; Returns: Json }
      transferer_attribution: {
        Args: {
          p_actuel?: boolean
          p_attributaire_id: string
          p_depuis?: string
          p_lot_id: string
          p_observation?: string
          p_qualite: Database["public"]["Enums"]["qualite_attribution"]
        }
        Returns: Json
      }
      type_document_annonce: { Args: { p_lot_id: string }; Returns: string }
      valider_invitation: { Args: { p_code: string }; Returns: Json }
      valider_paiement_manuel: {
        Args: { p_paiement_id: string; p_validateur: string }
        Returns: undefined
      }
      verifier_attestation: { Args: { p_ref: string }; Returns: Json }
      verifier_document: { Args: { p_ref: string }; Returns: Json }
    }
    Enums: {
      canal_notification: "whatsapp" | "email" | "sms"
      groupe_utilisateur:
        | "admin"
        | "chefferie"
        | "proprietaire_terrien"
        | "proprietaire"
        | "operateur"
        | "operateur_saisie"
        | "acquereur"
        | "verificateur"
        | "agent_ia"
        | "geometre"
        | "commissaire"
        | "amenageur"
      moyen_paiement:
        | "wave"
        | "orange_money"
        | "mtn_money"
        | "moov_money"
        | "virement"
        | "especes"
        | "autre"
      nature_droit:
        | "droit_coutumier"
        | "attestation_villageoise"
        | "certificat_foncier"
        | "acd"
        | "titre_foncier"
      qualite_attribution:
        | "ayant_droit"
        | "ayant_droit_transmission"
        | "acquereur"
        | "operateur"
        | "entrepreneur"
        | "reservataire"
        | "legs"
      role_partie:
        | "cedant"
        | "cessionnaire"
        | "operateur"
        | "temoin"
        | "chefferie"
      statut_apfc: "a_delivrer" | "en_cours" | "delivree"
      statut_att_cession: "a_generer" | "generee" | "delivree" | "revoquee"
      statut_certificat_vente: "a_generer" | "generee" | "delivree" | "annulee"
      statut_cession: "en_cours" | "solde" | "annulee"
      statut_demande_acquisition:
        | "nouvelle"
        | "en_discussion"
        | "accord"
        | "convertie"
        | "refusee"
        | "annulee"
      statut_demarche:
        | "en_attente_paiement"
        | "payee_en_cours"
        | "en_traitement"
        | "terminee"
        | "suspendue_litige"
        | "annulee"
      statut_dossier_adu:
        | "en_preparation"
        | "piece_manquante"
        | "depose"
        | "en_instruction"
        | "adu_delivree"
        | "acd_obtenu"
        | "rejete"
      statut_echeance: "a_venir" | "payee" | "en_retard"
      statut_litige: "ouvert" | "en_mediation" | "tranche" | "clos"
      statut_lot:
        | "libre"
        | "reserve_equipement"
        | "attribue"
        | "occupe"
        | "vendu"
        | "en_litige"
      statut_mission_geometre:
        | "en_preparation"
        | "en_cours"
        | "terminee"
        | "annulee"
      statut_notification: "en_attente" | "envoye" | "echoue" | "ignore"
      statut_paiement:
        | "en_attente"
        | "confirme"
        | "echoue"
        | "rembourse"
        | "initie"
        | "en_attente_validation"
      statut_pv_bornage: "generee" | "delivree" | "revoquee"
      statut_pv_famille: "a_fournir" | "fourni" | "valide" | "rejete"
      statut_vente: "en_cours" | "soldee" | "annulee"
      type_attributaire:
        | "personne_physique"
        | "collectif_ayants_droit"
        | "personne_morale"
      type_constat:
        | "constat_litige"
        | "constat_occupation"
        | "constat_limites"
        | "constat_non_contestation"
        | "autre"
      type_demarche:
        | "delivrance_attestation_cession"
        | "transmission"
        | "enterinement_chefferie"
        | "mutation_acquereur"
        | "bornage"
        | "demande_acd"
        | "levee_litige"
        | "autre"
      type_document:
        | "apfc"
        | "attestation_cession"
        | "plan_lotissement"
        | "plan_lot"
        | "piece_identite"
        | "acte_vente"
        | "quittance"
        | "acd"
        | "titre_foncier"
        | "autre"
        | "certificat_propriete_coutumiere"
        | "pv_constatation"
        | "attestation_non_contestation"
        | "plan_localisation"
        | "certificat_residence"
        | "demande_adu"
        | "adu"
        | "certificat_vente"
        | "pv_reunion_famille"
        | "pv_bornage"
      type_mission_geometre:
        | "bornage"
        | "morcellement"
        | "implantation"
        | "expertise_judiciaire"
        | "leve_topographique"
        | "immatriculation"
        | "copropriete"
        | "autre"
      type_paiement:
        | "attestation_cession"
        | "honoraires"
        | "autre"
        | "vente_terrain"
        | "pass_marketplace"
      type_transaction:
        | "attribution"
        | "vente"
        | "transmission"
        | "cession"
        | "donation"
        | "succession"
        | "bail"
      type_vente: "comptant" | "echelonne"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_notification: ["whatsapp", "email", "sms"],
      groupe_utilisateur: [
        "admin",
        "chefferie",
        "proprietaire_terrien",
        "proprietaire",
        "operateur",
        "operateur_saisie",
        "acquereur",
        "verificateur",
        "agent_ia",
        "geometre",
        "commissaire",
        "amenageur",
      ],
      moyen_paiement: [
        "wave",
        "orange_money",
        "mtn_money",
        "moov_money",
        "virement",
        "especes",
        "autre",
      ],
      nature_droit: [
        "droit_coutumier",
        "attestation_villageoise",
        "certificat_foncier",
        "acd",
        "titre_foncier",
      ],
      qualite_attribution: [
        "ayant_droit",
        "ayant_droit_transmission",
        "acquereur",
        "operateur",
        "entrepreneur",
        "reservataire",
        "legs",
      ],
      role_partie: [
        "cedant",
        "cessionnaire",
        "operateur",
        "temoin",
        "chefferie",
      ],
      statut_apfc: ["a_delivrer", "en_cours", "delivree"],
      statut_att_cession: ["a_generer", "generee", "delivree", "revoquee"],
      statut_certificat_vente: ["a_generer", "generee", "delivree", "annulee"],
      statut_cession: ["en_cours", "solde", "annulee"],
      statut_demande_acquisition: [
        "nouvelle",
        "en_discussion",
        "accord",
        "convertie",
        "refusee",
        "annulee",
      ],
      statut_demarche: [
        "en_attente_paiement",
        "payee_en_cours",
        "en_traitement",
        "terminee",
        "suspendue_litige",
        "annulee",
      ],
      statut_dossier_adu: [
        "en_preparation",
        "piece_manquante",
        "depose",
        "en_instruction",
        "adu_delivree",
        "acd_obtenu",
        "rejete",
      ],
      statut_echeance: ["a_venir", "payee", "en_retard"],
      statut_litige: ["ouvert", "en_mediation", "tranche", "clos"],
      statut_lot: [
        "libre",
        "reserve_equipement",
        "attribue",
        "occupe",
        "vendu",
        "en_litige",
      ],
      statut_mission_geometre: [
        "en_preparation",
        "en_cours",
        "terminee",
        "annulee",
      ],
      statut_notification: ["en_attente", "envoye", "echoue", "ignore"],
      statut_paiement: [
        "en_attente",
        "confirme",
        "echoue",
        "rembourse",
        "initie",
        "en_attente_validation",
      ],
      statut_pv_bornage: ["generee", "delivree", "revoquee"],
      statut_pv_famille: ["a_fournir", "fourni", "valide", "rejete"],
      statut_vente: ["en_cours", "soldee", "annulee"],
      type_attributaire: [
        "personne_physique",
        "collectif_ayants_droit",
        "personne_morale",
      ],
      type_constat: [
        "constat_litige",
        "constat_occupation",
        "constat_limites",
        "constat_non_contestation",
        "autre",
      ],
      type_demarche: [
        "delivrance_attestation_cession",
        "transmission",
        "enterinement_chefferie",
        "mutation_acquereur",
        "bornage",
        "demande_acd",
        "levee_litige",
        "autre",
      ],
      type_document: [
        "apfc",
        "attestation_cession",
        "plan_lotissement",
        "plan_lot",
        "piece_identite",
        "acte_vente",
        "quittance",
        "acd",
        "titre_foncier",
        "autre",
        "certificat_propriete_coutumiere",
        "pv_constatation",
        "attestation_non_contestation",
        "plan_localisation",
        "certificat_residence",
        "demande_adu",
        "adu",
        "certificat_vente",
        "pv_reunion_famille",
        "pv_bornage",
      ],
      type_mission_geometre: [
        "bornage",
        "morcellement",
        "implantation",
        "expertise_judiciaire",
        "leve_topographique",
        "immatriculation",
        "copropriete",
        "autre",
      ],
      type_paiement: [
        "attestation_cession",
        "honoraires",
        "autre",
        "vente_terrain",
        "pass_marketplace",
      ],
      type_transaction: [
        "attribution",
        "vente",
        "transmission",
        "cession",
        "donation",
        "succession",
        "bail",
      ],
      type_vente: ["comptant", "echelonne"],
    },
  },
} as const
