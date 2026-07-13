"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronsUpDown, Rows2, Rows3, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DUR, EASE } from "@/lib/motion";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export type Column<T> = {
  id: string;
  header: string;
  /** Rendu de la cellule. */
  cell: (row: T) => React.ReactNode;
  /** Valeur de tri / de recherche. Rendre la colonne triable en la fournissant. */
  sortBy?: (row: T) => string | number | null;
  /** Texte indexé par la recherche (par défaut : `sortBy`). */
  searchBy?: (row: T) => string;
  align?: "left" | "right";
  /** Largeur CSS (ex. "12rem", "1fr"). */
  width?: string;
  /** Colonne secondaire : masquée sous `md` pour tenir sur mobile. */
  secondary?: boolean;
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

/**
 * DataGrid premium — le tableau de référence de la plateforme.
 *
 * Choix de fond : le tri et la recherche s'appliquent **en mémoire**, sur un
 * jeu déjà chargé. C'est volontaire — les vues du dashboard sont bornées (files
 * de traitement, priorités). Pour un registre complet (900 lots), on garde les
 * pages dédiées qui filtrent côté serveur ; ce composant ne doit pas devenir un
 * prétexte à tout charger dans le navigateur.
 */
export function DataGrid<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  searchPlaceholder = "Rechercher…",
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyTone = "neutral",
  onRowClick,
  initialSort = null,
  pageSize = 8,
  toolbarExtra,
  className,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  getRowId: (row: T) => string;
  loading?: boolean;
  searchPlaceholder?: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  emptyTone?: "neutral" | "positive" | "pending";
  onRowClick?: (row: T) => void;
  initialSort?: SortState;
  pageSize?: number;
  toolbarExtra?: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(initialSort);
  const [dense, setDense] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const searchable = React.useMemo(
    () => columns.filter((c) => c.searchBy ?? c.sortBy),
    [columns],
  );

  const visible = React.useMemo(() => {
    let out = rows;

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((row) =>
        searchable.some((c) => {
          const raw = c.searchBy ? c.searchBy(row) : String(c.sortBy?.(row) ?? "");
          return raw.toLowerCase().includes(q);
        }),
      );
    }

    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortBy) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const va = col.sortBy!(a);
          const vb = col.sortBy!(b);
          // Les valeurs manquantes tombent toujours en fin de liste, quel que
          // soit le sens du tri : une ligne vide n'est jamais « la meilleure ».
          if (va === null || va === "") return 1;
          if (vb === null || vb === "") return -1;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb), "fr") * dir;
        });
      }
    }

    return out;
  }, [rows, query, sort, columns, searchable]);

  const shown = expanded ? visible : visible.slice(0, pageSize);
  const hidden = visible.length - shown.length;

  const toggleSort = (id: string) =>
    setSort((cur) => {
      if (cur?.id !== id) return { id, dir: "desc" };
      if (cur.dir === "desc") return { id, dir: "asc" };
      return null;
    });

  const template = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ");
  const rowPad = dense ? "py-1.5" : "py-2.5";

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(false);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        {toolbarExtra}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => setDense((d) => !d)}
              aria-pressed={dense}
              aria-label={dense ? "Densité confortable" : "Densité compacte"}
            >
              {dense ? <Rows3 /> : <Rows2 />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{dense ? "Densité confortable" : "Densité compacte"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <div className="min-w-[34rem]" role="table" aria-rowcount={visible.length}>
          <div
            role="row"
            className="grid items-center gap-3 border-y border-border bg-inset/60 px-5 py-2"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => {
              const active = sort?.id === c.id;
              const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <div
                  key={c.id}
                  role="columnheader"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortBy ? "none" : undefined}
                  className={cn(
                    "text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase",
                    c.align === "right" && "text-right",
                    c.secondary && "hidden md:block",
                  )}
                >
                  {c.sortBy ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                        active && "text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      <Icon className={cn("size-3", active ? "text-accent" : "text-muted-foreground/50")} aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </div>
              );
            })}
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid items-center gap-3 px-5 py-3" style={{ gridTemplateColumns: template }}>
                  {columns.map((c) => (
                    <Skeleton key={c.id} className={cn("h-4", c.secondary && "hidden md:block")} />
                  ))}
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={query ? "Aucun résultat" : emptyTitle}
              description={query ? `Rien ne correspond à « ${query} ».` : emptyDescription}
              tone={query ? "neutral" : emptyTone}
            />
          ) : (
            <div className="divide-y divide-border">
              {shown.map((row, i) => {
                const id = getRowId(row);
                const interactive = Boolean(onRowClick);
                return (
                  <motion.div
                    key={id}
                    role="row"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: DUR.fast, ease: EASE, delay: Math.min(i * 0.02, 0.16) }}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={interactive ? () => onRowClick!(row) : undefined}
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick!(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "grid items-center gap-3 px-5 text-[13px] outline-none",
                      rowPad,
                      interactive &&
                        "cursor-pointer transition-colors hover:bg-inset/70 focus-visible:bg-inset focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                    )}
                    style={{ gridTemplateColumns: template }}
                  >
                    {columns.map((c) => (
                      <div
                        key={c.id}
                        role="cell"
                        className={cn("min-w-0", c.align === "right" && "text-right", c.secondary && "hidden md:block")}
                      >
                        {c.cell(row)}
                      </div>
                    ))}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="border-t border-border py-2.5 text-[12.5px] font-semibold text-accent transition-colors hover:bg-inset"
        >
          Afficher les {hidden} lignes restantes
        </button>
      )}
    </div>
  );
}
