"use client";

import clsx from "clsx";
import { forwardRef } from "react";

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, helperText, className, children, ...props }, ref) => (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <select
        ref={ref}
        {...props}
        className={clsx(
          "w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-base text-slate-900 focus:border-[#B1C20E] focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/20",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-100",
          className,
        )}
      >
        {children}
      </select>
      {error ? (
        <span className="text-xs font-medium text-rose-600">{error}</span>
      ) : (
        helperText && <span className="text-xs text-slate-500">{helperText}</span>
      )}
    </label>
  ),
);

SelectField.displayName = "SelectField";
