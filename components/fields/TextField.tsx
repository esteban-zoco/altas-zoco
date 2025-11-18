"use client";

import clsx from "clsx";
import { forwardRef } from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, helperText, className, ...props }, ref) => (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <input
        ref={ref}
        {...props}
        className={clsx(
          "w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#B1C20E] focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/20",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-100",
          className,
        )}
      />
      {error ? (
        <span className="text-xs font-medium text-rose-600">{error}</span>
      ) : (
        helperText && <span className="text-xs text-slate-500">{helperText}</span>
      )}
    </label>
  ),
);

TextField.displayName = "TextField";
