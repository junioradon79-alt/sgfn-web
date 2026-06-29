import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`
            block w-full rounded-md
            bg-[#F8FAFC] border border-slate-300
            px-3 py-2 text-base font-medium text-[#111827]
            placeholder:text-slate-400
            transition focus:outline-none
            focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10
            ${error ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20" : ""}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? "input-error" : undefined}
          {...props}
        />
        {error && (
          <p
            id="input-error"
            className="mt-1 text-xs text-[#EF4444] font-medium"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";