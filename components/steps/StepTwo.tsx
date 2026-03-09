"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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

const BENEFICIAL_OWNERS_LEGAL_TEXT_RAW = `Resolución 112/2021 UIF Artículo 2°-. Beneficiario/a Final: será considerado Beneficiario/a Final a la/s persona/s humana/s que posea/n como mínimo el diez por ciento (10 %) del capital o
de los derechos de voto de una persona jurídica, un fideicomiso, un fondo de inversión, un patrimonio de afectación y/o de cualquier otra estructura jurídica; y/o a la/s persona/s humana/s
que por otros medios ejerza/n el control final de las mismas. Se entenderá como control final al ejercido, de manera directa o indirecta, por una o más personas humanas mediante una
cadena de titularidad y/o a través de cualquier otro medio de control y/o cuando, por circunstancias de hecho o derecho, la/s misma/s tenga/n la potestad de conformar por sí la voluntad
social para la toma de las decisiones por parte del órgano de gobierno de la persona jurídica o estructura jurídica y/o para la designación y/o remoción de integrantes del órgano de
administración de las mismas. Cuando no sea posible individualizar a aquella/s persona/s humana/s que revista/n la condición de Beneficiario/a Final conforme a la definición precedente,
se considerará Beneficiario/a Final a la persona humana que tenga a su cargo la dirección, administración o representación de la persona jurídica, fideicomiso, fondo de inversión, o
cualquier otro patrimonio de afectación y/o estructura jurídica, según corresponda. Ello, sin perjuicio de las facultades de la UNIDAD DE INFORMACIÓN FINANCIERA para verificar y
supervisar las causas que llevaron a la no identificación de el/la Beneficiario/a Final en los términos establecidos en los párrafos primero y segundo del presente artículo. En el caso de los
contratos de fideicomisos y/u otras estructuras jurídicas similares nacionales o extranjeras, se deberá individualizar a los beneficiarios finales de cada una de las partes del contrato.
Resolución 112/2021 UIF Artículo 5° - Identificación de el/la Beneficiario/a Final sin perjuicio del nivel de riesgo de los Clientes. Medidas para su identificación. Sin perjuicio del nivel de riesgo
asignado por el Sujeto Obligado a sus Clientes, en todos los casos se deberá identificar al Beneficiario/a Final, como así también se deberá mantener actualizada la información respecto del
mismo/a. A los fines de identificar a/los beneficiarios finales de los Clientes, éstos deberán presentar una declaración jurada conteniendo los siguientes datos: nombre/s y apellido/s, DNI,
domicilio real, nacionalidad, profesión, estado civil, porcentaje de participación y/o titularidad y/o control, y CUIT/CUIL/CDI en caso de corresponder. En caso de tratarse de una cadena de
titularidad se deberá describir la misma hasta llegar a la persona/s humana/s que ejerza/n el control final conforme lo dispuesto en el artículo 2° de la presente norma. Deberá acompañarse,
en cada caso, la respectiva documentación respaldatoria, estatutos societarios, registros de acciones o participaciones societarias, contratos, transferencia de participaciones y/o
cualquier otro documento que acredite la cadena de titularidad y/o control. Sin perjuicio de ello, se podrá solicitar cualquier otro dato, información y/o documentación que a criterio del
Sujeto Obligado permita identificar y verificar la identidad de el/la Beneficiario/a Final de sus Clientes y evaluar y gestionar adecuadamente los riesgos de LA/FT, de acuerdo con los
sistemas de gestión de riesgo implementados por el Sujeto Obligado. Cuando la participación mayoritaria del Sujeto Obligado persona jurídica corresponda a una sociedad que realice oferta
pública de sus valores negociables, listados en un mercado local o internacional autorizado y la misma esté sujeta a requisitos sobre transparencia y/o revelación de información, deberá
indicar tal circunstancia a los efectos de poder ser exceptuado de este requisito de identificación. Dicha excepción sólo tendrá lugar en la medida que se garantice el acceso oportuno a la
información respectiva y que la misma guarde estricta correspondencia con la exigida por la UNIDAD DE INFORMACIÓN FINANCIERA para la identificación de el/la Beneficiario/a Final. Toda
la información y/o documentación colectada deberá ser incorporada al legajo del Cliente. Actualización de la Información: toda modificación y/o cambio de el/la Beneficiario/a Final, deberá
ser informado por el Cliente al Sujeto Obligado, en un plazo máximo de TREINTA (30) días corridos de ocurrido el mismo.`;

const BENEFICIAL_OWNERS_LEGAL_TEXT = BENEFICIAL_OWNERS_LEGAL_TEXT_RAW.replace(
  /\\s+/g,
  " ",
).trim();

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
      ? `Último guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

  const persistValues = (values: StepTwoFormValues) => {
    if (isNatural) {
      const {
        businessName: _businessName,
        businessAddress: _businessAddress,
        companyCuit: _companyCuit,
        representative: _representative,
        beneficialOwners: _beneficialOwners,
        ...naturalValues
      } = values as Record<string, unknown>;
      updateNaturalPersonData(naturalValues as NaturalStepValues);
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
                      href="https://www.bna.com.ar/Downloads/F61050AnexoDatosDelCliente_NominaDeFuncionesPEPS.pdf"
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
                  Domicilio de la razón social
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Calle"
                    {...register(`${businessAddressPrefix}.street` as const)}
                    error={legalErrors.businessAddress?.street?.message}
                  />
                  <TextField
                    label="Número"
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
                    label="Código Postal"
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
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Declaración jurada: beneficiarios finales
                  </p>
                  <p className="text-xs text-slate-600">
                    Informá los socios/accionistas directos e indirectos para
                    identificar a los beneficiarios finales.
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
                      {beneficialOwnersLegalTextOpen ? "Ver menos" : "Ver más"}
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
                          label="Profesión"
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
                          label="% de participación / titularidad / control"
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
                          label="Carácter de participación"
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
                              label="¿Es PEP?"
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
                              <option value="true">Sí</option>
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
