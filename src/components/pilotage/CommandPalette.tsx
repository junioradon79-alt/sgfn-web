"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LogOut, Monitor, Moon, RefreshCw, Sun, UserRound } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { SECTION_LABELS, SECTION_ORDER, type NavItem } from "@/lib/navigation";
import type { ThemeChoice } from "@/hooks/useTheme";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ds/command";

/**
 * Palette ⌘K — l'accès clavier à toute la plateforme.
 *
 * Elle n'expose que les entrées que le rôle courant a le droit de voir : elle
 * consomme la liste déjà filtrée par `visibleNavItems`, jamais `NAV_ITEMS` brut.
 * C'est ce qui permet de supprimer le bloc « Actions rapides » de l'écran sans
 * rien perdre : les actions sont ici, à une frappe.
 */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  onNouveauDossier,
  onRefresh,
  onSetTheme,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: NavItem[];
  onNouveauDossier: () => void;
  onRefresh: () => void;
  onSetTheme: (t: ThemeChoice) => void;
}) {
  const router = useRouter();

  const run = React.useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  const deconnexion = React.useCallback(async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  }, [router]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Rechercher une page, lancer une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="nouveau dossier adu instruction créer"
            onSelect={() => run(onNouveauDossier)}
          >
            <FilePlus2 />
            Nouveau dossier ADU
          </CommandItem>
          <CommandItem value="actualiser rafraîchir données recharger" onSelect={() => run(onRefresh)}>
            <RefreshCw />
            Actualiser les données
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {SECTION_ORDER.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <CommandGroup key={section} heading={SECTION_LABELS[section]}>
              {sectionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.keywords ?? ""}`}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <Icon />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        <CommandGroup heading="Apparence">
          <CommandItem value="thème clair light" onSelect={() => run(() => onSetTheme("light"))}>
            <Sun />
            Thème clair
          </CommandItem>
          <CommandItem value="thème sombre dark nuit" onSelect={() => run(() => onSetTheme("dark"))}>
            <Moon />
            Thème sombre
          </CommandItem>
          <CommandItem value="thème système automatique" onSelect={() => run(() => onSetTheme("system"))}>
            <Monitor />
            Suivre le système
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Compte">
          <CommandItem value="profil mon compte" onSelect={() => run(() => router.push("/dashboard/profil"))}>
            <UserRound />
            Mon profil
          </CommandItem>
          <CommandItem value="déconnexion se déconnecter quitter" onSelect={() => run(() => void deconnexion())}>
            <LogOut />
            Se déconnecter
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
