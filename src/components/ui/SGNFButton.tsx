"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function SGFNButton({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const variants = {
    primary:
      "bg-blue-700 hover:bg-blue-800 text-white",

    secondary:
      "bg-slate-200 hover:bg-slate-300 text-slate-900",

    danger:
      "bg-red-600 hover:bg-red-700 text-white",

    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-700",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",

    md: "px-5 py-3 text-base",

    lg: "px-6 py-4 text-lg",
  };

  return (
    <button
      {...props}
      className={clsx(
        "rounded-xl font-semibold transition duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}