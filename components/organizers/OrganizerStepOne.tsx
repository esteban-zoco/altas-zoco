"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { RadioCardGroup } from "@/components/fields/RadioCardGroup";
import { SelectField } from "@/components/fields/SelectField";
import { TextField } from "@/components/fields/TextField";
import { useOrganizerOnboardingForm } from "@/hooks/useOrganizerOnboardingForm";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import {
  organizerStepOneSchema,
  type OrganizerStepOneValues,
} from "@/lib/organizerSchemas";
import { ORGANIZER_TYPE_OPTIONS } from "@/types/organizerOnboarding";

const DOCUMENT_TYPE_OPTIONS = [
  { label: "DNI", value: "DNI" },
  { label: "Pasaporte", value: "Pasaporte" },
  { label: "Cedula", value: "Cedula" },
  { label: "Libreta civica", value: "Libreta civica" },
  { label: "Libreta de enrolamiento", value: "Libreta de enrolamiento" },
] as const;

export const OrganizerStepOne = () => {
  const {
    state,
    setOrganizerType,
    updateHumanData,
    updateEntityData,
    nextStep,
    saveDraft,
    lastDraftSavedAt,
  } = useOrganizerOnboardingForm();
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const form = useForm<OrganizerStepOneValues>({
    resolver: zodResolver(organizerStepOneSchema),
    defaultValues: {
      organizerType: state.organizerType,
      humanData: { ...state.humanData },
      entityData: { ...state.entityData, representative: { ...state.entityData.representative } },
    },
  });

  const {
    handleSubmit,
    control,
    register,
    reset,
    getValues,
    watch,
    formState: { errors },
  } = form;

  // eslint-disable-next-line react-hooks/incompatible-library
  const organizerType = watch("organizerType");
  const entityKindLabel =
    organizerType === "nonprofit" ? "Tipo de entidad" : "Tipo societario";

  useEffect(() => {
    reset({
      organizerType: state.organizerType,
      humanData: { ...state.humanData },
      entityData: {
        ...state.entityData,
        representative: { ...state.entityData.representative },
      },
    });
  }, [reset, state]);

  const persistValues = (values: OrganizerStepOneValues) => {
    setOrganizerType(values.organizerType);
    updateHumanData(values.humanData);
    updateEntityData(values.entityData);
  };

  const onSubmit = (values: OrganizerStepOneValues) => {
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
        step={1}
        title="Tipo e identificacion"
        description="Completamos primero los datos base del organizador."
        primaryButton={{ label: "Siguiente", type: "submit" }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Tipo de organizador
            </p>
            <Controller
              control={control}
              name="organizerType"
              render={({ field }) => (
                <RadioCardGroup
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    setOrganizerType(value as OrganizerStepOneValues["organizerType"]);
                  }}
                  options={ORGANIZER_TYPE_OPTIONS}
                />
              )}
            />
          </div>

          {organizerType === "human" ? (
            <>
              <Alert
                title="Persona humana"
                description="Solicitamos los datos personales del organizador tal como figuran en su documentacion."
              />
              <TextField
                label="Nombre y apellido completo"
                {...register("humanData.fullName")}
                error={errors.humanData?.fullName?.message}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Tipo de documento"
                  defaultValue=""
                  {...register("humanData.documentType")}
                  error={errors.humanData?.documentType?.message}
                >
                  <option value="" disabled>
                    Selecciona una opcion
                  </option>
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Numero de documento"
                  {...register("humanData.documentNumber")}
                  error={errors.humanData?.documentNumber?.message}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="humanData.cuitCuil"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="CUIT/CUIL"
                      placeholder="20-XXXXXXXX-X"
                      value={formatCuit(field.value)}
                      onChange={(event) =>
                        field.onChange(sanitizeCuitInput(event.target.value))
                      }
                      error={errors.humanData?.cuitCuil?.message}
                    />
                  )}
                />
                <TextField
                  label="Fecha de nacimiento"
                  type="date"
                  {...register("humanData.birthDate")}
                  error={errors.humanData?.birthDate?.message}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Nacionalidad"
                  {...register("humanData.nationality")}
                  error={errors.humanData?.nationality?.message}
                />
                <TextField
                  label="Estado civil"
                  {...register("humanData.maritalStatus")}
                  error={errors.humanData?.maritalStatus?.message}
                />
              </div>
            </>
          ) : (
            <>
              <Alert
                title="Entidad organizadora"
                description="Completamos la identificacion de la entidad y en el proximo paso los datos del representante."
              />
              <TextField
                label="Razon social"
                {...register("entityData.businessName")}
                error={errors.entityData?.businessName?.message}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="entityData.cuit"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="CUIT"
                      placeholder="30-XXXXXXXX-X"
                      value={formatCuit(field.value)}
                      onChange={(event) =>
                        field.onChange(sanitizeCuitInput(event.target.value))
                      }
                      error={errors.entityData?.cuit?.message}
                    />
                  )}
                />
                <TextField
                  label="Fecha de constitucion"
                  type="date"
                  {...register("entityData.constitutionDate")}
                  error={errors.entityData?.constitutionDate?.message}
                />
              </div>
              <TextField
                label={entityKindLabel}
                placeholder={
                  organizerType === "nonprofit"
                    ? "Ej: Asociacion civil"
                    : "Ej: SAS, SRL, SA"
                }
                {...register("entityData.entityKind")}
                error={errors.entityData?.entityKind?.message}
              />
            </>
          )}
        </div>
      </StepLayout>
    </form>
  );
};
