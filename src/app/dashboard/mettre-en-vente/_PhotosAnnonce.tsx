"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Trash2, ImageOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";

const MAX_PHOTOS = 8;
const MAX_TAILLE_OCTETS = 5 * 1024 * 1024;
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

type Photo = {
  id: string;
  chemin: string;
  ordre: number;
};

export default function PhotosAnnonce({ annonceId }: { annonceId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { isLoading: loading } = useChargement(async () => {
    const { data } = await supabase
      .from("photos_annonces")
      .select("id, chemin, ordre")
      .eq("annonce_id", annonceId)
      .order("ordre", { ascending: true });
    setPhotos((data as Photo[]) ?? []);
  }, [supabase, annonceId]);

  const publicUrl = (chemin: string) =>
    supabase.storage.from("annonces-photos").getPublicUrl(chemin).data.publicUrl;

  const ajouterFichiers = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return;
    setErreur(null);

    const place = MAX_PHOTOS - photos.length;
    const liste = Array.from(fichiers).slice(0, Math.max(place, 0));
    if (liste.length === 0) {
      setErreur(`Maximum ${MAX_PHOTOS} photos par annonce.`);
      return;
    }

    setEnvoi(true);
    let compteur = photos.length;
    const ajoutees: Photo[] = [];

    for (const fichier of liste) {
      if (!TYPES_ACCEPTES.includes(fichier.type)) {
        setErreur("Formats acceptés : JPEG, PNG, WebP.");
        continue;
      }
      if (fichier.size > MAX_TAILLE_OCTETS) {
        setErreur("Chaque photo doit faire moins de 5 Mo.");
        continue;
      }

      const chemin = `${annonceId}/${crypto.randomUUID()}-${fichier.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("annonces-photos")
        .upload(chemin, fichier);
      if (uploadErr) {
        setErreur(uploadErr.message);
        continue;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("photos_annonces")
        .insert({ annonce_id: annonceId, chemin, ordre: compteur })
        .select("id, chemin, ordre")
        .single();
      if (insertErr) {
        setErreur(insertErr.message);
        continue;
      }
      ajoutees.push(inserted as Photo);
      compteur += 1;
    }

    setPhotos((prev) => [...prev, ...ajoutees]);
    setEnvoi(false);
  };

  const supprimer = async (photo: Photo) => {
    setErreur(null);
    const { error: storageErr } = await supabase.storage
      .from("annonces-photos")
      .remove([photo.chemin]);
    if (storageErr) {
      setErreur(storageErr.message);
      return;
    }
    const { error: dbErr } = await supabase.from("photos_annonces").delete().eq("id", photo.id);
    if (dbErr) {
      setErreur(dbErr.message);
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        {photos.length} / {MAX_PHOTOS} photos — la première sert de photo de couverture sur TerraCI Market.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[#0D3B66]" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(photo.chemin)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => void supprimer(photo)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Supprimer cette photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {photos.length === 0 && (
            <div className="col-span-3 flex aspect-[3/1] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 sm:col-span-4">
              <ImageOff className="h-4 w-4" /> Aucune photo pour le moment
            </div>
          )}

          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-500 transition hover:border-[#0D3B66] hover:text-[#0D3B66]">
              {envoi ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              Ajouter
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                disabled={envoi}
                onChange={(e) => void ajouterFichiers(e.target.files)}
              />
            </label>
          )}
        </div>
      )}

      {erreur && <p className="mt-2 text-xs font-medium text-red-600">{erreur}</p>}
    </div>
  );
}
