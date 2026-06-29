
// Bouton
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

export interface ButtonProps {
  variant: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

// Badge de parcelle
export type ParcelBadgeState = 'disponible' | 'attribué' | 'litige' | 'en_cours_de_validation';

export interface ParcelBadgeProps {
  state: ParcelBadgeState;
  label?: string;
  className?: string;
}

// Sidebar
export interface SidebarItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  active?: boolean;
  children?: SidebarItem[];
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  className?: string;
}

