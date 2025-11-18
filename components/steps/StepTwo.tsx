"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { SelectField } from "@/components/fields/SelectField";
import { TextField } from "@/components/fields/TextField";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import {
  LegalStepValues,
  NaturalStepValues,
  legalPersonSchema,
  naturalPersonSchema,
} from "@/lib/schemas";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import { TAX_CONDITIONS } from "@/types/onboarding";

type StepTwoFormValues = NaturalStepValues | LegalStepValues;

const rentasOptions = [
  { key: "inscripto", label: "Inscripto" },
  { key: "exento", label: "Exento" },
  { key: "convenioMultilateral", label: "Convenio Multilateral" },
] as const;

export const StepTwo = () => {
  const {
    state,
    updateNaturalPersonData,
    updateLegalPersonData,
    nextStep,
    previousStep,
    saveDraft,
    lastDraftSavedAt,
  } = useOnboardingForm();
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const isNatural = state.personType === "PF";

  const schema = isNatural ? naturalPersonSchema : legalPersonSchema;
  const defaultValues = useMemo<StepTwoFormValues>(() => {
    if (isNatural) {
      return {
        ...state.naturalPersonData,
        address: { ...state.naturalPersonData.address },
        rentas: { ...state.naturalPersonData.rentas },
      };
    }
    return {
      ...state.legalPersonData,
      address: { ...state.legalPersonData.address },
      representative: { ...state.legalPersonData.representative },
      rentas: { ...state.legalPersonData.rentas },
    };
  }, [isNatural, state.naturalPersonData, state.legalPersonData]);

  const form = useForm<StepTwoFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const {
    handleSubmit,
    register,
    reset,
    formState,
    getValues,
    control,
    watch,
  } = form;
  const naturalErrors = formState.errors as FieldErrors<NaturalStepValues>;
  const legalErrors = formState.errors as FieldErrors<LegalStepValues>;
  // eslint-disable-next-line react-hooks/incompatible-library
  const isPepSelected = watch("isPep");
  const pepReasonError = isNatural
    ? naturalErrors.pepReason?.message
    : legalErrors.pepReason?.message;

  const savedFeedback =
    savedToast ??
    (lastDraftSavedAt
      ? `Último guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

  const persistValues = (values: StepTwoFormValues) => {
    if (isNatural) {
      updateNaturalPersonData(values as NaturalStepValues);
    } else {
      updateLegalPersonData(values as LegalStepValues);
    }
  };

  const onSubmit = (values: StepTwoFormValues) => {
    persistValues(values);
    nextStep();
  };

  const handleSave = () => {
    persistValues(getValues());
    saveDraft();
    setSavedToast("Datos guardados en tu dispositivo");
    setTimeout(() => setSavedToast(null), 4000);
  };

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const addressPrefix = "address";

  const renderRentas = (
    errors: FieldErrors<NaturalStepValues | LegalStepValues>,
  ) => (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700">Rentas provinciales</p>
      <div className="grid gap-2 md:grid-cols-3">
        {rentasOptions.map((option) => (
          <Controller
            key={option.key}
            name={`rentas.${option.key}` as const}
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#B1C20E] focus:ring-[#B1C20E]"
                />
                {option.label}
              </label>
            )}
          />
        ))}
      </div>
      {errors?.rentas && (
        <span className="text-xs font-medium text-rose-600">
          Seleccioná tu situación frente a Rentas
        </span>
      )}
    </div>
  );

  const renderPep = (label: string, error?: string) => (
    <Controller
      name="isPep"
      control={control}
      render={({ field }) => (
        <SelectField
          label={label}
          value={field.value ? "true" : "false"}
          onChange={(event) => field.onChange(event.target.value === "true")}
          error={error}
        >
          <option value="false">No</option>
          <option value="true">Sí</option>
        </SelectField>
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <StepLayout
        step={2}
        title="Datos legales y fiscales"
        description="Completá la información requerida por la normativa vigente."
        onBack={previousStep}
        primaryButton={{ label: "Siguiente", type: "submit" }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-8">
          <Alert
            title="¡Listo! Creaste tu cuenta en Zoco."
            description="Ahora solo falta completar algunos datos para activar los cobros."
            variant="success"
          />
          {isNatural ? (
            <>
              <TextField
                label="Nombre y apellido completo"
                {...register("fullName")}
                error={naturalErrors.fullName?.message}
              />
              <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Domicilio real
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Calle"
                    {...register(`${addressPrefix}.street` as const)}
                    error={naturalErrors.address?.street?.message}
                  />
                  <TextField
                    label="Número"
                    {...register(`${addressPrefix}.number` as const)}
                    error={naturalErrors.address?.number?.message}
                  />
                  <TextField
                    label="Piso/Depto (opcional)"
                    {...register(`${addressPrefix}.floor` as const)}
                    error={naturalErrors.address?.floor?.message}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Localidad"
                    {...register(`${addressPrefix}.city` as const)}
                    error={naturalErrors.address?.city?.message}
                  />
                  <TextField
                    label="Provincia"
                    {...register(`${addressPrefix}.province` as const)}
                    error={naturalErrors.address?.province?.message}
                  />
                  <TextField
                    label="Código Postal"
                    {...register(`${addressPrefix}.postalCode` as const)}
                    error={naturalErrors.address?.postalCode?.message}
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <TextField
                  label="Fecha de nacimiento"
                  type="date"
                  {...register("birthDate")}
                  error={naturalErrors.birthDate?.message}
                />
                <TextField
                  label="Nacionalidad"
                  {...register("nationality")}
                  error={naturalErrors.nationality?.message}
                />
              </div>
              {renderRentas(naturalErrors)}
              {renderPep(
                "¿Sos una Persona Expuesta Políticamente (PEP)?",
                naturalErrors.isPep?.message,
              )}
              {isPepSelected && (
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-700">
                    En caso afirmativo, indicá el motivo y adjuntá cualquier
                    detalle relevante. Consultá la{" "}
                    <a
                      href="https://www.argentina.gob.ar/normativa/nacional/ley-25246-59842"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#B1C20E]"
                    >
                      Ley 25.246
                    </a>{" "}
                    para conocer las obligaciones vigentes.
                  </p>
                  <label className="text-sm text-slate-700">
                    Motivo / aclaraciones
                    <textarea
                      {...register("pepReason")}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#B1C20E] focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/20"
                      rows={3}
                    />
                  </label>
                  {pepReasonError && (
                    <p className="text-xs font-medium text-rose-600">
                      {pepReasonError}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    Además, asumís el compromiso de informar cualquier
                    modificación dentro de los próximos 30 días mediante una
                    nueva declaración jurada.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <TextField
                label="Razón social"
                {...register("businessName")}
                error={legalErrors.businessName?.message}
              />
              <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Domicilio Representante legal 
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Calle"
                    {...register(`${addressPrefix}.street` as const)}
                    error={legalErrors.address?.street?.message}
                  />
                  <TextField
                    label="Número"
                    {...register(`${addressPrefix}.number` as const)}
                    error={legalErrors.address?.number?.message}
                  />
                  <TextField
                    label="Piso/Depto (opcional)"
                    {...register(`${addressPrefix}.floor` as const)}
                    error={legalErrors.address?.floor?.message}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Localidad"
                    {...register(`${addressPrefix}.city` as const)}
                    error={legalErrors.address?.city?.message}
                  />
                  <TextField
                    label="Provincia"
                    {...register(`${addressPrefix}.province` as const)}
                    error={legalErrors.address?.province?.message}
                  />
                  <TextField
                    label="Código Postal"
                    {...register(`${addressPrefix}.postalCode` as const)}
                    error={legalErrors.address?.postalCode?.message}
                  />
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Representante legal / persona autorizada
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Nombre y apellido"
                    {...register("representative.fullName")}
                    error={legalErrors.representative?.fullName?.message}
                  />
                  <TextField
                    label="DNI"
                    {...register("representative.dni")}
                    error={legalErrors.representative?.dni?.message}
                  />
                  <Controller
                    name="representative.cuit"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="CUIT del representante"
                        value={formatCuit(field.value)}
                        onChange={(event) =>
                          field.onChange(
                            sanitizeCuitInput(event.target.value ?? ""),
                          )
                        }
                        error={legalErrors.representative?.cuit?.message}
                      />
                    )}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    {...register("representative.email")}
                    error={legalErrors.representative?.email?.message}
                  />
                  <TextField
                    label="Teléfono"
                    {...register("representative.phone")}
                    error={legalErrors.representative?.phone?.message}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Estos datos pueden ser verificados posteriormente por el equipo
                  de Zoco según la normativa vigente.
                </p>
              </div>
              {renderRentas(legalErrors)}
              {renderPep(
                "¿El representante es una Persona Expuesta Políticamente (PEP)?",
                legalErrors.isPep?.message,
              )}
              {isPepSelected && (
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-700">
                    En caso afirmativo, indicá el motivo y adjuntá cualquier
                    detalle relevante. Consultá la{" "}
                    <a
                      href="https://www.argentina.gob.ar/normativa/nacional/ley-25246-59842"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#B1C20E]"
                    >
                      Ley 25.246
                    </a>{" "}
                    para conocer las obligaciones vigentes.
                  </p>
                  <label className="text-sm text-slate-700">
                    Motivo / aclaraciones
                    <textarea
                      {...register("pepReason")}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#B1C20E] focus:outline-none focus:ring-2 focus:ring-[#B1C20E]/20"
                      rows={3}
                    />
                  </label>
                  {pepReasonError && (
                    <p className="text-xs font-medium text-rose-600">
                      {pepReasonError}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    Además, asumimos el compromiso de informar cualquier
                    modificación dentro de los próximos 30 días mediante una
                    nueva declaración jurada.
                  </p>
                </div>
              )}
            </>
          )}
          <SelectField
            label="Condición fiscal (AFIP)"
            {...register("taxCondition")}
            error={
              (isNatural
                ? naturalErrors.taxCondition?.message
                : legalErrors.taxCondition?.message) as string | undefined
            }
          >
            {TAX_CONDITIONS.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Alert
          title="Guardá y seguí cuando quieras"
          description="Podés pausar acá y retomarlo más tarde. Guardamos tus avances en este dispositivo."
        />
      </StepLayout>
    </form>
  );
};
