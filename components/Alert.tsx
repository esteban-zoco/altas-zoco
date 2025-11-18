"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

type AlertVariant = "info" | "success" | "error";

const variantStyles: Record<AlertVariant, string> = {
  info: "bg-[#B1C20E]/10 text-[#4F5606] ring-[#B1C20E]/30",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  error: "bg-rose-50 text-rose-800 ring-rose-100",
};

const variantIcon: Record<AlertVariant, ReactNode> = {
  info: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
};

export const Alert = ({
  title,
  description,
  variant = "info",
}: {
  title: string;
  description?: ReactNode;
  variant?: AlertVariant;
}) => (
  <div
    className={clsx(
      "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1",
      variantStyles[variant],
    )}
  >
    <span className="mt-0.5">{variantIcon[variant]}</span>
    <div>
      <p className="font-medium">{title}</p>
      {description && <div className="text-xs opacity-80">{description}</div>}
    </div>
  </div>
);
