"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { SelectField } from "@/components/fields/SelectField";
import { TextField } from "@/components/fields/TextField";
import { usePaidOrganizerOnboardingForm } from "@/hooks/usePaidOrganizerOnboardingForm";
import {
  LegalStepValues,
  NaturalStepValues,
  legalPersonSchema,
  naturalPersonSchema,
} from "@/lib/schemas";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import { TAX_CONDITIONS } from "@/types/onboarding";

type StepTwoFormValues = NaturalStepValues | LegalStepValues;

const BENEFICIAL_OWNERS_LEGAL_TEXT_RAW = `Resolucion 112/2021 UIF Articulo 2. Beneficiario/a Final: sera considerado Beneficiario/a Final a la/s persona/s humana/s que posea/n como minimo el diez por ciento (10 %) del capital o
de los derechos de voto de una persona juridica, un fideicomiso, un fondo de inversion, un patrimonio de afectacion y/o de cualquier otra estructura juridica; y/o a la/s persona/s humana/s
que por otros medios ejerza/n el control final de las mismas. Se entendera como control final al ejercido, de manera directa o indirecta, por una o mas personas humanas mediante una
cadena de titularidad y/o a traves de cualquier otro medio de control y/o cuando, por circunstancias de hecho o derecho, la/s misma/s tenga/n la potestad de conformar por si la voluntad
social para la toma de las decisiones por parte del organo de gobierno de la persona juridica o estructura juridica y/o para la designacion y/o remocion de integrantes del organo de
administracion de las mismas. Cuando no sea posible individualizar a aquella/s persona/s humana/s que revista/n la condicion de Beneficiario/a Final conforme a la definicion precedente,
se considerara Beneficiario/a Final a la persona humana que tenga a su cargo la direccion, administracion o representacion de la persona juridica, fideicomiso, fondo de inversion, o
cualquier otro patrimonio de afectacion y/o estructura juridica, segun corresponda.`;

const BENEFICIAL_OWNERS_LEGAL_TEXT = BENEFICIAL_OWNERS_LEGAL_TEXT_RAW.replace(
  /\s+/g,
  " ",
).trim();

const rentasOptions = [
  { key: "inscripto", label: "Inscripto" },
  { key: "exento", label: "Exento" },
  { key: "convenioMultilateral", label: "Convenio Multilateral" },
] as const;

export const PaidOrganizerStepTwo = () => {
  const {
    state,
    updateNaturalPersonData,
    updateLegalPersonData,
    nextStep,
    previousStep,
    saveDraft,
    lastDraftSavedAt,
  } = usePaidOrganizerOnboardingForm();
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [beneficialOwnersLegalTextOpen, setBeneficialOwnersLegalTextOpen] =
    useState(false);
  const isNatural = state.personType === "PF";

  const buildEmptyBeneficialOwner =
    (): LegalStepValues["beneficialOwners"][number] => ({
      fullName: "",
      dni: "",
      cuit: "",
      participationPercent: "",
      participationType: "directa",
      nationality: "",
      profession: "",
      maritalStatus: "",
      address: "",
      isPep: false,
    });

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
      beneficialOwners:
        state.legalPersonData.beneficialOwners?.map((owner) => ({ ...owner })) ??
        [],
      businessAddress: { ...state.legalPersonData.businessAddress },
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

  const beneficialOwnersFieldArray = useFieldArray({
    control,
    name: "beneficialOwners" as never,
  });
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
      ? `Ultimo guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
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
  const businessAddressPrefix = "businessAddress";

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
          Selecciona tu situacion frente a Rentas
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
          <option value="true">Si</option>
        </SelectField>
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <StepLayout
        step={2}
        title="Datos legales y fiscales"
        description="Completa la informacion requerida para habilitar los cobros del organizador."
        onBack={previousStep}
        primaryButton={{ label: "Siguiente", type: "submit" }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-8">
          <Alert
            title="Ya casi esta"
            description="Ahora solo falta completar los datos legales y fiscales del organizador."
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
                    label="Numero"
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
                    label="Codigo Postal"
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
                "Eres una Persona Expuesta Politicamente (PEP)?",
                naturalErrors.isPep?.message,
              )}
              {isPepSelected && (
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-700">
                    En caso afirmativo, indica el motivo y cualquier detalle
                    relevante.
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
                </div>
              )}
            </>
          ) : (
            <>
              <TextField
                label="Razon social"
                {...register("businessName")}
                error={legalErrors.businessName?.message}
              />
              <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Domicilio de la razon social
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Calle"
                    {...register(`${businessAddressPrefix}.street` as const)}
                    error={legalErrors.businessAddress?.street?.message}
                  />
                  <TextField
                    label="Numero"
                    {...register(`${businessAddressPrefix}.number` as const)}
                    error={legalErrors.businessAddress?.number?.message}
                  />
                  <TextField
                    label="Piso/Depto (opcional)"
                    {...register(`${businessAddressPrefix}.floor` as const)}
                    error={legalErrors.businessAddress?.floor?.message}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Localidad"
                    {...register(`${businessAddressPrefix}.city` as const)}
                    error={legalErrors.businessAddress?.city?.message}
                  />
                  <TextField
                    label="Provincia"
                    {...register(`${businessAddressPrefix}.province` as const)}
                    error={legalErrors.businessAddress?.province?.message}
                  />
                  <TextField
                    label="Codigo Postal"
                    {...register(
                      `${businessAddressPrefix}.postalCode` as const,
                    )}
                    error={legalErrors.businessAddress?.postalCode?.message}
                  />
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Representante legal
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
                    label="Telefono"
                    {...register("representative.phone")}
                    error={legalErrors.representative?.phone?.message}
                  />
                </div>
              </div>
              <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Domicilio del representante legal
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Calle"
                    {...register(`${addressPrefix}.street` as const)}
                    error={legalErrors.address?.street?.message}
                  />
                  <TextField
                    label="Numero"
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
                    label="Codigo Postal"
                    {...register(`${addressPrefix}.postalCode` as const)}
                    error={legalErrors.address?.postalCode?.message}
                  />
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Declaracion jurada: beneficiarios finales
                  </p>
                  <p className="text-xs text-slate-600">
                    Informa los socios/accionistas directos e indirectos.
                  </p>
                  <div className="space-y-1">
                    <p
                      className={
                        beneficialOwnersLegalTextOpen
                          ? "text-xs text-slate-600 whitespace-normal leading-relaxed"
                          : "text-xs text-slate-600 truncate"
                      }
                    >
                      {BENEFICIAL_OWNERS_LEGAL_TEXT}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setBeneficialOwnersLegalTextOpen((prev) => !prev)
                      }
                      className="text-left text-xs font-semibold text-[#B1C20E]"
                      aria-expanded={beneficialOwnersLegalTextOpen}
                    >
                      {beneficialOwnersLegalTextOpen ? "Ver menos" : "Ver mas"}
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {beneficialOwnersFieldArray.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-4 rounded-2xl bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700">
                          Beneficiario final #{index + 1}
                        </p>
                        {beneficialOwnersFieldArray.fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => beneficialOwnersFieldArray.remove(index)}
                            className="rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            Quitar
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <TextField
                          label="Nombre y apellido"
                          {...register(
                            `beneficialOwners.${index}.fullName` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]?.fullName
                              ?.message as string | undefined
                          }
                        />
                        <TextField
                          label="DNI"
                          {...register(`beneficialOwners.${index}.dni` as const)}
                          error={
                            legalErrors.beneficialOwners?.[index]?.dni
                              ?.message as string | undefined
                          }
                        />
                        <Controller
                          name={`beneficialOwners.${index}.cuit` as const}
                          control={control}
                          render={({ field: controllerField }) => (
                            <TextField
                              label="CUIT"
                              value={formatCuit(controllerField.value)}
                              onChange={(event) =>
                                controllerField.onChange(
                                  sanitizeCuitInput(event.target.value ?? ""),
                                )
                              }
                              error={
                                legalErrors.beneficialOwners?.[index]?.cuit
                                  ?.message as string | undefined
                              }
                            />
                          )}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <TextField
                          label="Nacionalidad"
                          {...register(
                            `beneficialOwners.${index}.nationality` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]?.nationality
                              ?.message as string | undefined
                          }
                        />
                        <TextField
                          label="Profesion"
                          {...register(
                            `beneficialOwners.${index}.profession` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]?.profession
                              ?.message as string | undefined
                          }
                        />
                        <TextField
                          label="Estado civil"
                          {...register(
                            `beneficialOwners.${index}.maritalStatus` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]?.maritalStatus
                              ?.message as string | undefined
                          }
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <TextField
                          label="% de participacion / titularidad / control"
                          {...register(
                            `beneficialOwners.${index}.participationPercent` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]
                              ?.participationPercent?.message as
                              | string
                              | undefined
                          }
                        />
                        <SelectField
                          label="Caracter de participacion"
                          {...register(
                            `beneficialOwners.${index}.participationType` as const,
                          )}
                          error={
                            legalErrors.beneficialOwners?.[index]
                              ?.participationType?.message as
                              | string
                              | undefined
                          }
                        >
                          <option value="directa">Directa</option>
                          <option value="indirecta">Indirecta</option>
                        </SelectField>
                        <Controller
                          name={`beneficialOwners.${index}.isPep` as const}
                          control={control}
                          render={({ field: controllerField }) => (
                            <SelectField
                              label="Es PEP?"
                              value={controllerField.value ? "true" : "false"}
                              onChange={(event) =>
                                controllerField.onChange(
                                  event.target.value === "true",
                                )
                              }
                              error={
                                legalErrors.beneficialOwners?.[index]?.isPep
                                  ?.message as string | undefined
                              }
                            >
                              <option value="false">No</option>
                              <option value="true">Si</option>
                            </SelectField>
                          )}
                        />
                      </div>

                      <TextField
                        label="Domicilio"
                        {...register(`beneficialOwners.${index}.address` as const)}
                        error={
                          legalErrors.beneficialOwners?.[index]?.address
                            ?.message as string | undefined
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    beneficialOwnersFieldArray.append(buildEmptyBeneficialOwner())
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Agregar beneficiario final
                </button>
              </div>
              {renderRentas(legalErrors)}
              {renderPep(
                "El representante es una Persona Expuesta Politicamente (PEP)?",
                legalErrors.isPep?.message,
              )}
              {isPepSelected && (
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-700">
                    En caso afirmativo, indica el motivo y cualquier detalle
                    relevante.
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
                </div>
              )}
            </>
          )}
          <SelectField
            label="Condicion fiscal (AFIP)"
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
          title="Guarda y sigue cuando quieras"
          description="Puedes pausar aqui y retomarlo mas tarde. Guardamos tus avances en este dispositivo."
        />
      </StepLayout>
    </form>
  );
};
