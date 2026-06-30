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
      attestations_cession: {
        Row: {
          acquereur_id: string
          apfc_id: string | null
          cession_id: string | null
          cree_le: string
          date_emission: string | null
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
          code: string
          commissaire_id: string | null
          cree_le: string
          cree_par: string
          email: string | null
          expire_le: string
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
          code?: string
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string
          email?: string | null
          expire_le?: string
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
          code?: string
          commissaire_id?: string | null
          cree_le?: string
          cree_par?: string
          email?: string | null
          expire_le?: string
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
      lotissements: {
        Row: {
          autorite_coutumiere_id: string | null
          commune: string | null
          cree_le: string
          district: string | null
          famille_id: string | null
          guide_reference: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nb_ilots: number | null
          nb_lots: number | null
          nom: string
          operateur_id: string | null
          pv_commissaire_justice_id: string | null
          pv_numero_enregistrement: string | null
          superficie_m2: number | null
          superficie_texte: string | null
          village: string | null
        }
        Insert: {
          autorite_coutumiere_id?: string | null
          commune?: string | null
          cree_le?: string
          district?: string | null
          famille_id?: string | null
          guide_reference?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_ilots?: number | null
          nb_lots?: number | null
          nom: string
          operateur_id?: string | null
          pv_commissaire_justice_id?: string | null
          pv_numero_enregistrement?: string | null
          superficie_m2?: number | null
          superficie_texte?: string | null
          village?: string | null
        }
        Update: {
          autorite_coutumiere_id?: string | null
          commune?: string | null
          cree_le?: string
          district?: string | null
          famille_id?: string | null
          guide_reference?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_ilots?: number | null
          nb_lots?: number | null
          nom?: string
          operateur_id?: string | null
          pv_commissaire_justice_id?: string | null
          pv_numero_enregistrement?: string | null
          superficie_m2?: number | null
          superficie_texte?: string | null
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
          id: string
          montant_reverse: number | null
          montant_total: number
          moyen: Database["public"]["Enums"]["moyen_paiement"] | null
          reference_externe: string | null
          statut: Database["public"]["Enums"]["statut_paiement"]
          type: Database["public"]["Enums"]["type_paiement"]
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
          id?: string
          montant_reverse?: number | null
          montant_total: number
          moyen?: Database["public"]["Enums"]["moyen_paiement"] | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          type?: Database["public"]["Enums"]["type_paiement"]
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
          id?: string
          montant_reverse?: number | null
          montant_total?: number
          moyen?: Database["public"]["Enums"]["moyen_paiement"] | null
          reference_externe?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          type?: Database["public"]["Enums"]["type_paiement"]
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
            foreignKeyName: "paiements_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
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
      conformite_lotissements: { Args: never; Returns: Json }
      creer_attestation_gratuite_si_eligible: {
        Args: { p_attributaire_id: string; p_lot_id: string }
        Returns: undefined
      }
      debug_mon_contexte: { Args: never; Returns: Json }
      disponibilites_foncieres: { Args: never; Returns: Json }
      est_admin: { Args: never; Returns: boolean }
      finaliser_inscription: { Args: { p_code: string }; Returns: Json }
      generer_code_invitation: { Args: never; Returns: string }
      get_public_stats: { Args: never; Returns: Json }
      ma_chefferie_id: { Args: never; Returns: string }
      manifester_interet: {
        Args: { p_lot_id: string; p_message?: string }
        Returns: string
      }
      marquer_echeances_en_retard: { Args: never; Returns: undefined }
      mon_attributaire_id: { Args: never; Returns: string }
      mon_commissaire_id: { Args: never; Returns: string }
      mon_groupe: {
        Args: never
        Returns: Database["public"]["Enums"]["groupe_utilisateur"]
      }
      mon_operateur_id: { Args: never; Returns: string }
      peut_contacter: { Args: { p_destinataire_id: string }; Returns: boolean }
      regenerer_document: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      sgfn_call_edge: {
        Args: { p_payload: Json; p_slug: string }
        Returns: undefined
      }
      suis_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      valider_invitation: { Args: { p_code: string }; Returns: Json }
      verifier_attestation: { Args: { p_ref: string }; Returns: Json }
      verifier_document: { Args: { p_ref: string }; Returns: Json }
    }
    Enums: {
      groupe_utilisateur:
        | "admin"
        | "chefferie"
        | "proprietaire"
        | "operateur"
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
      statut_paiement: "en_attente" | "confirme" | "echoue" | "rembourse"
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
      type_paiement:
        | "attestation_cession"
        | "honoraires"
        | "autre"
        | "vente_terrain"
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
      groupe_utilisateur: [
        "admin",
        "chefferie",
        "proprietaire",
        "operateur",
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
      statut_paiement: ["en_attente", "confirme", "echoue", "rembourse"],
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
      ],
      type_paiement: [
        "attestation_cession",
        "honoraires",
        "autre",
        "vente_terrain",
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
