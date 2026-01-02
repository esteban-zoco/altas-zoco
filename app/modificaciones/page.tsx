"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Alert } from "@/components/Alert";
import { FileUploadItem } from "@/components/documents/FileUploadItem";
import { TextField } from "@/components/fields/TextField";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import {
  type ModificationRequestFormValues,
  type ModificationRequestValues,
  type ModificationType,
  modificationRequestSchema,
} from "@/lib/modificationRequestSchema";

const CHANGE_OPTIONS: {
  value: ModificationType;
  title: string;
  description: string;
}[] = [
  {
    value: "fantasyName",
    title: "Nombre de fantasía",
    description: "Actualizá el nombre comercial que mostramos en Zoco.",
  },
  {
    value: "paymentAccount",
    title: "Boca de pago",
    description: "Informá el nuevo alias o CBU y los datos del titular.",
  },
  {
    value: "address",
    title: "Dirección del local",
    description: "Indicá qué sucursal cambia de domicilio.",
  },
] as const;

const ACCEPT_IMAGES_AND_PDF = "image/*,application/pdf";

const buildDefaultValues = (): ModificationRequestFormValues => ({
  cuit: "",
  fantasyName: "",
  contactEmail: "",
  contactPhone: "",
  changeTypes: [],
  fantasyNameCurrent: "",
  fantasyNameNew: "",
  paymentCurrentIdentifier: "",
  paymentNewIdentifier: "",
  paymentHolderDocument: "",
  paymentHolderName: "",
  paymentNotes: "",
  addressStoreReference: "",
  addressCurrent: {
    street: "",
    number: "",
    floor: "",
    city: "",
    province: "",
    postalCode: "",
  },
  addressNew: {
    street: "",
    number: "",
    floor: "",
    city: "",
    province: "",
    postalCode: "",
  },
});

type ServerMessage = { type: "success" | "error"; text: string };

const ModificationPage = () => {
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentProofs, setPaymentProofs] = useState<File[]>([]);

  const form = useForm<
    ModificationRequestFormValues,
    undefined,
    ModificationRequestValues
  >({
    resolver: zodResolver(modificationRequestSchema),
    defaultValues: buildDefaultValues(),
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = form;

  const selectedChanges = watch("changeTypes") ?? [];
  const paymentAccountSelected = selectedChanges.includes("paymentAccount");
  const isSelected = (type: ModificationType) => selectedChanges.includes(type);

  useEffect(() => {
    if (!paymentAccountSelected && paymentProofs.length) {
      setPaymentProofs([]);
    }
  }, [paymentAccountSelected, paymentProofs.length]);

  const onSubmit = async (values: ModificationRequestValues) => {
    setServerMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(values));
      if (paymentAccountSelected) {
        paymentProofs.forEach((file, index) =>
          formData.append(
            "paymentProofs",
            file,
            file.name || `constancia-cbu-${index + 1}.pdf`,
          ),
        );
      }
      const response = await fetch("/api/modification-request", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          error?.error ?? "No pudimos enviar la solicitud. Probá nuevamente.",
        );
      }
      setServerMessage({
        type: "success",
        text: "Recibimos tu solicitud. Un asesor de Zoco te va a contactar para confirmar el cambio.",
      });
      reset(buildDefaultValues());
      setPaymentProofs([]);
    } catch (error) {
      console.error("Error enviando modificación", error);
      setServerMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No pudimos enviar la solicitud. Intentá más tarde.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
        <Link
          href="/"
          className="text-sm font-semibold text-[#B1C20E] hover:underline"
        >
          &larr; Volver al formulario de alta
        </Link>
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <header className="space-y-3 border-b border-slate-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B1C20E]">
              Aliados Zoco
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">
              Modificá tus datos
            </h1>
            <p className="text-sm text-slate-600">
              Elegí qué información querés actualizar y completá los
              campos correspondientes. Nuestro equipo validará el cambio y te
              contactará si necesita más detalles.
            </p>
          </header>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-8">
            {serverMessage && (
              <Alert
                title={serverMessage.text}
                variant={serverMessage.type === "success" ? "success" : "error"}
              />
            )}
            <Alert
              title="Identificación del comercio"
              description="Estos datos se usan para localizar rápidamente tu cuenta y acelerar la validación."
            />
            <div className="grid gap-6 md:grid-cols-2">
              <Controller
                name="cuit"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="CUIT"
                    value={formatCuit(field.value)}
                    onChange={(event) =>
                      field.onChange(sanitizeCuitInput(event.target.value))
                    }
                    error={errors.cuit?.message}
                  />
                )}
              />
              <TextField
                label="Nombre de fantasía"
                {...register("fantasyName")}
                error={errors.fantasyName?.message}
              />
              <TextField
                label="Email de contacto"
                type="email"
                {...register("contactEmail")}
                error={errors.contactEmail?.message}
              />
              <TextField
                label="Teléfono / WhatsApp"
                type="tel"
                {...register("contactPhone")}
                error={errors.contactPhone?.message}
              />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">
                ¿Qué querés modificar?
              </p>
              <Controller
                name="changeTypes"
                control={control}
                render={({ field }) => (
                  <div className="grid gap-4 md:grid-cols-3">
                    {CHANGE_OPTIONS.map((option) => {
                      const checked = field.value?.includes(option.value);
                      const toggle = () => {
                        const current = field.value ?? [];
                        field.onChange(
                          checked
                            ? current.filter((value) => value !== option.value)
                            : [...current, option.value],
                        );
                      };
                      return (
                        <button
                          type="button"
                          key={option.value}
                          onClick={toggle}
                          aria-pressed={checked}
                          className={clsx(
                            "rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/30",
                            checked
                              ? "border-[#B1C20E] bg-[#F7F9D7]"
                              : "border-slate-200 hover:border-slate-300",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {option.title}
                            </p>
                            <span
                              className={clsx(
                                "h-5 w-5 rounded-full border",
                                checked
                                  ? "border-[#B1C20E] bg-[#B1C20E]"
                                  : "border-slate-300",
                              )}
                              aria-hidden="true"
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-600">
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              {errors.changeTypes && (
                <p className="text-xs font-medium text-rose-600">
                  {errors.changeTypes.message}
                </p>
              )}
            </div>

            {isSelected("fantasyName") && (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  Cambiar nombre de fantasía
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Nombre actual"
                    {...register("fantasyNameCurrent")}
                    error={errors.fantasyNameCurrent?.message}
                  />
                  <TextField
                    label="Nuevo nombre"
                    {...register("fantasyNameNew")}
                    error={errors.fantasyNameNew?.message}
                  />
                </div>
              </div>
            )}

            {isSelected("paymentAccount") && (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  Actualizar boca de pago
                </p>
                <TextField
                  label="Alias o CBU anterior (opcional)"
                  {...register("paymentCurrentIdentifier")}
                  error={errors.paymentCurrentIdentifier?.message}
                  helperText="Nos ayuda a ubicar la boca de pago anterior."
                />
                <TextField
                  label="Nuevo alias o CBU"
                  {...register("paymentNewIdentifier")}
                  error={errors.paymentNewIdentifier?.message}
                  helperText="Si cargás un CBU/CVU debe tener 22 dígitos."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Titular (nombre o razón social)"
                    {...register("paymentHolderName")}
                    error={errors.paymentHolderName?.message}
                  />
                  <TextField
                    label="CUIT o DNI del titular"
                    {...register("paymentHolderDocument")}
                    error={errors.paymentHolderDocument?.message}
                  />
                </div>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-medium">Notas adicionales (opcional)</span>
                  <textarea
                    rows={3}
                    {...register("paymentNotes")}
                    className="rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#B1C20E] focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/20"
                    placeholder="Ej: Banco, tipo de cuenta, aclaraciones..."
                  />
                </label>
                <FileUploadItem
                  title="Constancia del nuevo CBU/alias"
                  description="Subí la captura o constancia emitida por tu banco. Formatos admitidos: imágenes o PDF."
                  accept={ACCEPT_IMAGES_AND_PDF}
                  allowMultiple
                  files={paymentProofs}
                  onFilesChange={setPaymentProofs}
                />
              </div>
            )}

            {isSelected("address") && (
              <div className="space-y-5 rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  Modificar domicilio de un local
                </p>
                <TextField
                  label="Sucursal / referencia del local"
                  {...register("addressStoreReference")}
                  error={errors.addressStoreReference?.message}
                  helperText="Ej: Local Centro, Isla 2, Kiosco 123."
                />
                <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Dirección actual
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField
                      label="Calle"
                      {...register("addressCurrent.street")}
                      error={errors.addressCurrent?.street?.message}
                    />
                    <TextField
                      label="Número"
                      {...register("addressCurrent.number")}
                      error={errors.addressCurrent?.number?.message}
                    />
                    <TextField
                      label="Piso/Depto (opcional)"
                      {...register("addressCurrent.floor")}
                      error={errors.addressCurrent?.floor?.message}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField
                      label="Localidad"
                      {...register("addressCurrent.city")}
                      error={errors.addressCurrent?.city?.message}
                    />
                    <TextField
                      label="Provincia"
                      {...register("addressCurrent.province")}
                      error={errors.addressCurrent?.province?.message}
                    />
                    <TextField
                      label="Código postal"
                      {...register("addressCurrent.postalCode")}
                      error={errors.addressCurrent?.postalCode?.message}
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Nueva dirección
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField
                      label="Calle"
                      {...register("addressNew.street")}
                      error={errors.addressNew?.street?.message}
                    />
                    <TextField
                      label="Número"
                      {...register("addressNew.number")}
                      error={errors.addressNew?.number?.message}
                    />
                    <TextField
                      label="Piso/Depto (opcional)"
                      {...register("addressNew.floor")}
                      error={errors.addressNew?.floor?.message}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField
                      label="Localidad"
                      {...register("addressNew.city")}
                      error={errors.addressNew?.city?.message}
                    />
                    <TextField
                      label="Provincia"
                      {...register("addressNew.province")}
                      error={errors.addressNew?.province?.message}
                    />
                    <TextField
                      label="Código postal"
                      {...register("addressNew.postalCode")}
                      error={errors.addressNew?.postalCode?.message}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Recibirás una confirmación por email una vez que revisemos la
                solicitud.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className={clsx(
                  "rounded-full bg-[#B1C20E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]",
                  isSubmitting && "cursor-not-allowed opacity-70",
                )}
              >
                {isSubmitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ModificationPage;
