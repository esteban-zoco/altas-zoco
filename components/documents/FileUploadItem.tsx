"use client";

import clsx from "clsx";
import { CheckCircle2, Image as ImageIcon, UploadCloud } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useId, useMemo } from "react";

interface FileUploadItemProps {
  title: string;
  description?: string;
  optional?: boolean;
  accept?: string;
  allowMultiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const FileUploadItem = ({
  title,
  description,
  optional,
  accept,
  allowMultiple,
  files,
  onFilesChange,
}: FileUploadItemProps) => {
  const inputId = useId();
  const previews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        isImage: file.type.startsWith("image/"),
        url: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      })),
    [files],
  );

  useEffect(
    () => () => {
      previews.forEach((preview) => {
        if (preview.url) URL.revokeObjectURL(preview.url);
      });
    },
    [previews],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
      ? Array.from(event.target.files)
      : [];
    onFilesChange(selectedFiles);
    event.target.value = "";
  };

  const hasFiles = files.length > 0;

  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {title}{" "}
            {optional && (
              <span className="text-xs font-normal text-slate-500">
                (opcional)
              </span>
            )}
          </p>
          {description && (
            <p className="text-sm text-slate-600">{description}</p>
          )}
        </div>
        {hasFiles ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        ) : (
          <UploadCloud className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <input
            type="file"
            id={inputId}
            className="sr-only"
            accept={accept}
            multiple={allowMultiple}
            onChange={handleChange}
          />
          <label
            htmlFor={inputId}
            className={clsx(
              "inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
              hasFiles
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200",
            )}
          >
            Subir archivo
          </label>
        </div>
        <p className="text-sm text-slate-500">
          {hasFiles
            ? `${files.length} archivo(s) listo(s)`
            : "Sin archivos adjuntos"}
        </p>
      </div>
      {previews.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {previews.map((item) => (
            <div
              key={`${item.name}-${item.url ?? "sin-preview"}`}
              className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2"
            >
              {item.isImage && item.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                </>
              ) : (
                <ImageIcon className="h-10 w-10 text-slate-300" />
              )}
              <span className="text-sm text-slate-700">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
