"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { TextField } from "@/components/fields/TextField";
import { useOrganizerOnboardingForm } from "@/hooks/useOrganizerOnboardingForm";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import {
  organizerStepTwoSchema,
  type OrganizerStepTwoValues,
} from "@/lib/organizerSchemas";
import { isEntityOrganizerType } from "@/types/organizerOnboarding";

const AddressFields = ({
  title,
  prefix,
  register,
  errors,
}: {
  title: string;
  prefix:
    | "humanData.realAddress"
    | "humanData.activityAddress"
    | "entityData.legalAddress"
    | "entityData.operationalAddress"
    | "entityData.representative.address";
  register: UseFormRegister<OrganizerStepTwoValues>;
  errors: {
    street?: { message?: string };
    number?: { message?: string };
    floor?: { message?: string };
    city?: { message?: string };
    province?: { message?: string };
    postalCode?: { message?: string };
  };
}) => (
  <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <div className="grid gap-4 md:grid-cols-3">
      <TextField
        label="Calle"
        {...register(`${prefix}.street` as const)}
        error={errors.street?.message}
      />
      <TextField
        label="Numero"
        {...register(`${prefix}.number` as const)}
        error={errors.number?.message}
      />
      <TextField
        label="Piso/Depto (opcional)"
        {...register(`${prefix}.floor` as const)}
        error={errors.floor?.message}
      />
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      <TextField
        label="Localidad"
        {...register(`${prefix}.city` as const)}
        error={errors.city?.message}
      />
      <TextField
        label="Provincia"
        {...register(`${prefix}.province` as const)}
        error={errors.province?.message}
      />
      <TextField
        label="Codigo postal"
        {...register(`${prefix}.postalCode` as const)}
        error={errors.postalCode?.message}
      />
    </div>
  </div>
);

export const OrganizerStepTwo = () => {
  const {
    state,
    updateHumanData,
    updateEntityData,
    previousStep,
    nextStep,
    saveDraft,
    lastDraftSavedAt,
  } = useOrganizerOnboardingForm();
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const isEntity = isEntityOrganizerType(state.organizerType);

  const form = useForm<OrganizerStepTwoValues>({
    resolver: zodResolver(organizerStepTwoSchema),
    defaultValues: {
      organizerType: state.organizerType,
      humanData: { ...state.humanData },
      entityData: {
        ...state.entityData,
        representative: {
          ...state.entityData.representative,
          address: { ...state.entityData.representative.address },
        },
      },
    },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors },
  } = form;

  // eslint-disable-next-line react-hooks/incompatible-library
  const sameActivityAddress = watch("humanData.sameActivityAddress");

  useEffect(() => {
    reset({
      organizerType: state.organizerType,
      humanData: { ...state.humanData, realAddress: { ...state.humanData.realAddress }, activityAddress: { ...state.humanData.activityAddress } },
      entityData: {
        ...state.entityData,
        legalAddress: { ...state.entityData.legalAddress },
        operationalAddress: { ...state.entityData.operationalAddress },
        representative: {
          ...state.entityData.representative,
          address: { ...state.entityData.representative.address },
        },
      },
    });
  }, [reset, state]);

  const persistValues = (values: OrganizerStepTwoValues) => {
    updateHumanData(values.humanData);
    updateEntityData(values.entityData);
  };

  const onSubmit = (values: OrganizerStepTwoValues) => {
    persistValues(values);
    nextStep();
  };

  const handleSave = () => {
    persistValues(getValues());
    saveDraft();
    setSavedToast("Datos guardados en este dispositivo");
    setTimeout(() => setSavedToast(null), 4000);
  };

  const savedFeedback =
    savedToast ??
    (lastDraftSavedAt
      ? `Ultimo guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <StepLayout
        step={2}
        title={isEntity ? "Domicilios y representacion" : "Domicilios y contacto"}
        description="Completamos ahora la informacion operativa necesaria para validar la solicitud."
        onBack={previousStep}
        primaryButton={{ label: "Siguiente", type: "submit" }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-6">
          {isEntity ? (
            <>
              <Alert
                title="Entidad organizadora"
                description="Necesitamos el domicilio de la entidad y los datos del representante legal o apoderado."
              />
              <AddressFields
                title="Domicilio legal"
                prefix="entityData.legalAddress"
                register={register}
                errors={errors.entityData?.legalAddress ?? {}}
              />
              <AddressFields
                title="Domicilio real / operativo"
                prefix="entityData.operationalAddress"
                register={register}
                errors={errors.entityData?.operationalAddress ?? {}}
              />
              <TextField
                label="Actividad principal"
                {...register("entityData.mainActivity")}
                error={errors.entityData?.mainActivity?.message}
              />
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Representante legal / apoderado
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Nombre y apellido"
                    {...register("entityData.representative.fullName")}
                    error={errors.entityData?.representative?.fullName?.message}
                  />
                  <TextField
                    label="DNI"
                    {...register("entityData.representative.dni")}
                    error={errors.entityData?.representative?.dni?.message}
                  />
                  <Controller
                    name="entityData.representative.cuitCuil"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="CUIT/CUIL"
                        value={formatCuit(field.value)}
                        onChange={(event) =>
                          field.onChange(sanitizeCuitInput(event.target.value))
                        }
                        error={
                          errors.entityData?.representative?.cuitCuil?.message
                        }
                      />
                    )}
                  />
                  <TextField
                    label="Fecha de nacimiento"
                    type="date"
                    {...register("entityData.representative.birthDate")}
                    error={
                      errors.entityData?.representative?.birthDate?.message
                    }
                  />
                  <TextField
                    label="Cargo"
                    {...register("entityData.representative.role")}
                    error={errors.entityData?.representative?.role?.message}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    {...register("entityData.representative.email")}
                    error={errors.entityData?.representative?.email?.message}
                  />
                  <TextField
                    label="Telefono"
                    {...register("entityData.representative.phone")}
                    error={errors.entityData?.representative?.phone?.message}
                  />
                </div>
                <AddressFields
                  title="Domicilio del representante"
                  prefix="entityData.representative.address"
                  register={register}
                  errors={errors.entityData?.representative?.address ?? {}}
                />
              </div>
            </>
          ) : (
            <>
              <Alert
                title="Organizador individual"
                description="Pedimos el domicilio real, el domicilio declarado para la actividad si corresponde y los datos de contacto."
              />
              <AddressFields
                title="Domicilio real"
                prefix="humanData.realAddress"
                register={register}
                errors={errors.humanData?.realAddress ?? {}}
              />
              <Controller
                name="humanData.sameActivityAddress"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#B1C20E] focus:ring-[#B1C20E]"
                    />
                    El domicilio declarado para la actividad es el mismo que el
                    domicilio real
                  </label>
                )}
              />
              {!sameActivityAddress && (
                <AddressFields
                  title="Domicilio declarado para la actividad"
                  prefix="humanData.activityAddress"
                  register={register}
                  errors={errors.humanData?.activityAddress ?? {}}
                />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Email"
                  type="email"
                  {...register("humanData.email")}
                  error={errors.humanData?.email?.message}
                />
                <TextField
                  label="Telefono"
                  {...register("humanData.phone")}
                  error={errors.humanData?.phone?.message}
                />
              </div>
            </>
          )}
        </div>
      </StepLayout>
    </form>
  );
};
