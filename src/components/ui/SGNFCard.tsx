import { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export default function SGNFCard({
  title,
  subtitle,
  children,
  className,
}: Props) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      {(title || subtitle) && (
        <header className="mb-5">
          {title && (
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
          )}

          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </header>
      )}

      {children}
    </section>
  );
}