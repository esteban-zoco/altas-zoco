"use client";

import clsx from "clsx";

interface RadioOption {
  label: string;
  value: string;
  description?: string;
}

interface RadioCardGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
}

export const RadioCardGroup = ({
  options,
  value,
  onChange,
}: RadioCardGroupProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded-2xl border px-4 py-3 text-left transition cursor-pointer",
            selected
              ? "border-[#B1C20E] bg-[#B1C20E]/10"
              : "border-slate-200 hover:border-slate-300",
          )}
        >
          <p className="text-base font-semibold text-slate-900">
            {option.label}
          </p>
          {option.description && (
            <p className="text-sm text-slate-600">{option.description}</p>
          )}
        </button>
      );
    })}
  </div>
);
