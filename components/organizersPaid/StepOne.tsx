"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { RadioCardGroup } from "@/components/fields/RadioCardGroup";
import { TextField } from "@/components/fields/TextField";
import { usePaidOrganizerOnboardingForm } from "@/hooks/usePaidOrganizerOnboardingForm";
import { formatCuit, sanitizeCuitInput } from "@/lib/cuit";
import { BasicStepValues, basicStepSchema } from "@/lib/schemas";

export const PaidOrganizerStepOne = () => {
  const {
    state,
    updateBasicData,
    updateLegalPersonData,
    setPersonType,
    nextStep,
    saveDraft,
    lastDraftSavedAt,
  } = usePaidOrganizerOnboardingForm();
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const form = useForm<BasicStepValues>({
    resolver: zodResolver(basicStepSchema),
    defaultValues: {
      personType: state.personType,
      cuit: state.basicData.cuit,
      fantasyName: state.basicData.fantasyName,
      contactEmail: state.basicData.contactEmail,
      phone: state.basicData.phone,
      bankIdentifier: state.basicData.bankIdentifier,
      commercialAddress: { ...state.basicData.commercialAddress },
    },
  });

  const {
    handleSubmit,
    control,
    register,
    formState,
    reset,
    getValues,
    watch,
  } = form;

  useEffect(() => {
    reset({
      personType: state.personType,
      cuit: state.basicData.cuit,
      fantasyName: state.basicData.fantasyName,
      contactEmail: state.basicData.contactEmail,
      phone: state.basicData.phone,
      bankIdentifier: state.basicData.bankIdentifier,
      commercialAddress: { ...state.basicData.commercialAddress },
    });
  }, [reset, state.basicData, state.personType]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const personType = watch("personType");

  const persistValues = (values: BasicStepValues) => {
    const cleanCuit = sanitizeCuitInput(values.cuit);
    setPersonType(values.personType);
    updateBasicData({
      cuit: cleanCuit,
      fantasyName: values.fantasyName,
      contactEmail: values.contactEmail,
      phone: values.phone,
      bankIdentifier: values.bankIdentifier,
      commercialAddress: {
        street: values.commercialAddress.street,
        number: values.commercialAddress.number,
        floor: values.commercialAddress.floor,
        city: values.commercialAddress.city,
        province: values.commercialAddress.province,
        postalCode: values.commercialAddress.postalCode,
      },
    });
    if (values.personType === "PJ") {
      updateLegalPersonData({
        companyCuit: cleanCuit,
      });
    }
  };

  const onSubmit = (values: BasicStepValues) => {
    persistValues(values);
    nextStep();
  };

  const handleSave = () => {
    persistValues(getValues());
    saveDraft();
    setSavedToast("Datos guardados en tu dispositivo");
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
        title="Alta organizador"
        description="Empecemos con los datos basicos para activar los cobros del organizador."
        primaryButton={{ label: "Siguiente", type: "submit" }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Tipo de persona</p>
            <Controller
              control={control}
              name="personType"
              render={({ field }) => (
                <RadioCardGroup
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  options={[
                    {
                      label: "Persona Fisica",
                      value: "PF",
                      description: "Titular humano, DNI",
                    },
                    {
                      label: "Persona Juridica",
                      value: "PJ",
                      description: "Sociedades, asociaciones, etc.",
                    },
                  ]}
                />
              )}
            />
            {formState.errors.personType && (
              <p className="text-xs font-medium text-rose-600">
                {formState.errors.personType.message}
              </p>
            )}
          </div>
          <Controller
            control={control}
            name="cuit"
            render={({ field }) => (
              <TextField
                label={
                  personType === "PJ"
                    ? "CUIT de la entidad organizadora"
                    : "CUIT del organizador"
                }
                placeholder="20-XXXXXXXX-X"
                value={formatCuit(field.value)}
                onChange={(event) =>
                  field.onChange(sanitizeCuitInput(event.target.value))
                }
                error={formState.errors.cuit?.message}
              />
            )}
          />
          <TextField
            label="Nombre de fantasia"
            placeholder="Ej: Productora Andina"
            {...register("fantasyName")}
            error={formState.errors.fantasyName?.message}
          />
          <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Domicilio operativo
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Calle"
                {...register("commercialAddress.street")}
                error={formState.errors.commercialAddress?.street?.message}
              />
              <TextField
                label="Numero"
                {...register("commercialAddress.number")}
                error={formState.errors.commercialAddress?.number?.message}
              />
              <TextField
                label="Piso/Depto (opcional)"
                {...register("commercialAddress.floor")}
                error={formState.errors.commercialAddress?.floor?.message}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Localidad"
                {...register("commercialAddress.city")}
                error={formState.errors.commercialAddress?.city?.message}
              />
              <TextField
                label="Provincia"
                {...register("commercialAddress.province")}
                error={formState.errors.commercialAddress?.province?.message}
              />
              <TextField
                label="Codigo Postal"
                {...register("commercialAddress.postalCode")}
                error={formState.errors.commercialAddress?.postalCode?.message}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              label="Email de contacto"
              type="email"
              placeholder="tu-email@zoco.com"
              {...register("contactEmail")}
              error={formState.errors.contactEmail?.message}
            />
            <TextField
              label="Celular / WhatsApp"
              placeholder="Ej: +54 11 1234-5678"
              {...register("phone")}
              error={formState.errors.phone?.message}
            />
          </div>
          <TextField
            label="CBU / CVU o Alias"
            placeholder="Ingresa 22 digitos o tu alias"
            {...register("bankIdentifier")}
            error={formState.errors.bankIdentifier?.message}
          />
          <Alert
            title="CBU/alias del titular"
            description="El CBU, CVU o alias tienen que pertenecer al mismo titular del organizador."
          />
        </div>
      </StepLayout>
    </form>
  );
};
