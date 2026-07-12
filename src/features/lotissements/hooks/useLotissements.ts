"use client";

import { useCallback, useState } from "react";

import { useChargement } from "@/hooks/useChargement";

import {
  getLotissements,
  createLotissement,
  updateLotissement,
  deleteLotissement,
} from "../services/lotissements.service";

import type {
  Lotissement,
  NewLotissement,
  UpdateLotissement,
} from "../types";

export function useLotissements() {
  const [lotissements, setLotissements] = useState<Lotissement[]>([]);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getLotissements();

    if (error) {
      setError(error.message);
      setLotissements([]);
    } else {
      setLotissements((data || []) as Lotissement[]);
    }
  }, []);

  const { isLoading: loading, recharger: refresh } = useChargement(load, [load]);

  // ➕ CREATE
  const create = async (values: NewLotissement) => {
    const { error } = await createLotissement(values);

    if (error) {
      setError(error.message);
      return;
    }

    await refresh();
  };

  // ✏️ UPDATE
  const update = async (id: string, values: UpdateLotissement) => {
    const { error } = await updateLotissement(id, values);

    if (error) {
      setError(error.message);
      return;
    }

    await refresh();
  };

  // 🗑 DELETE
  const remove = async (id: string) => {
    const { error } = await deleteLotissement(id);

    if (error) {
      setError(error.message);
      return;
    }

    await refresh();
  };

  return {
    lotissements,
    loading,
    error,
    refresh,

    create,
    update,
    remove,
  };
}