"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await getLotissements();

    if (error) {
      setError(error.message);
      setLotissements([]);
    } else {
      setError(null);
      setLotissements(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const create = async (values: NewLotissement) => {
    const { error } = await createLotissement(values);

    if (error) {
      setError(error.message);
      return;
    }

    setError(null);
    await refresh();
  };

  const update = async (id: string, values: UpdateLotissement) => {
    const { error } = await updateLotissement(id, values);

    if (error) {
      setError(error.message);
      return;
    }

    setError(null);
    await refresh();
  };

  const remove = async (id: string) => {
    setLotissements((prev) =>
      prev.filter((lotissement) => lotissement.id !== id)
    );

    const { error } = await deleteLotissement(id);

    if (error) {
      setError(error.message);
      await refresh();
    }
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
