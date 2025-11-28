import { jsPDF } from "jspdf";

import type {
  Address,
  RentasStatus,
  SubmittedOnboardingSummary,
} from "@/types/onboarding";

const RENTAS_LABELS: Record<keyof RentasStatus, string> = {
  inscripto: "Inscripto",
  exento: "Exento",
  convenioMultilateral: "Convenio Multilateral",
};

const formatAddress = (address: Address) => {
  const streetLine = [address.street, address.number].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province].filter(Boolean).join(", ");
  const parts = [
    streetLine.trim(),
    address.floor?.trim(),
    [cityLine, address.postalCode ? `(${address.postalCode})` : ""]
      .join(" ")
      .trim(),
  ].filter((value) => value && value !== "()") as string[];

  return parts.length ? parts.join(" - ") : "-";
};

const formatRentas = (rentas: RentasStatus) => {
  const enabled = Object.entries(rentas)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => RENTAS_LABELS[key as keyof RentasStatus]);
  return enabled.length ? enabled.join(", ") : "Sin datos";
};

const formatPep = (isPep: boolean, reason: string) =>
  isPep ? `Si - ${reason || "sin detalle"}` : "No";

const formatDocs = (files: string[]) =>
  files.filter(Boolean).length ? files.join(", ") : "Sin archivos";

export const generateSubmissionPdf = (
  submission: SubmittedOnboardingSummary,
) => {
  const doc = new jsPDF();
  const marginX = 15;
  const startY = 20;
  const lineHeight = 6;
  const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  const { payload, submittedAt } = submission;
  let cursorY = startY;

  const ensureSpace = (lines = 1) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (cursorY + lineHeight * lines > pageHeight - 15) {
      doc.addPage();
      cursorY = startY;
    }
  };

  const addParagraph = (text: string) => {
    const rows = doc.splitTextToSize(text, contentWidth);
    rows.forEach((row: string) => {
      ensureSpace();
      doc.text(row, marginX, cursorY);
      cursorY += lineHeight;
    });
  };

  const addSection = (title: string) => {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, marginX, cursorY);
    cursorY += lineHeight + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Resumen de solicitud enviada", marginX, cursorY);
  cursorY += lineHeight + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  addParagraph(
    `Fecha de envio: ${submittedAt.toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    })}`,
  );
  addParagraph(
    `Tipo de persona: ${
      payload.personType === "PF" ? "Persona Fisica" : "Persona Juridica"
    }`,
  );

  addSection("Datos basicos");
  addParagraph(`CUIT principal: ${payload.basicData.cuit || "-"}`);
  addParagraph(`Nombre de fantasia: ${payload.basicData.fantasyName || "-"}`);
  addParagraph(`Email de contacto: ${payload.basicData.contactEmail || "-"}`);
  addParagraph(`Telefono: ${payload.basicData.phone || "-"}`);
  addParagraph(
    `Domicilio comercial: ${formatAddress(payload.basicData.commercialAddress)}`,
  );
  addParagraph(`CBU / CVU o Alias: ${payload.basicData.bankIdentifier || "-"}`);

  if (payload.personType === "PF") {
    addSection("Datos legales (persona fisica)");
    addParagraph(`Nombre completo: ${payload.naturalPersonData.fullName || "-"}`);
    addParagraph(
      `Domicilio real: ${formatAddress(payload.naturalPersonData.address)}`,
    );
    addParagraph(
      `Fecha de nacimiento: ${payload.naturalPersonData.birthDate || "-"}`,
    );
    addParagraph(`Nacionalidad: ${payload.naturalPersonData.nationality || "-"}`);
    addParagraph(
      `Condicion fiscal: ${payload.naturalPersonData.taxCondition || "-"}`,
    );
    addParagraph(
      `Rentas: ${formatRentas(payload.naturalPersonData.rentas)}`,
    );
    addParagraph(
      `PEP: ${formatPep(
        payload.naturalPersonData.isPep,
        payload.naturalPersonData.pepReason,
      )}`,
    );
  } else {
    addSection("Datos legales (persona juridica)");
    addParagraph(`Razon social: ${payload.legalPersonData.businessName || "-"}`);
    addParagraph(
      `CUIT de la sociedad: ${payload.legalPersonData.companyCuit || "-"}`,
    );
    addParagraph(
      `Domicilio legal: ${formatAddress(payload.legalPersonData.address)}`,
    );
    addParagraph(
      `Condicion fiscal: ${payload.legalPersonData.taxCondition || "-"}`,
    );
    addParagraph(
      `Rentas: ${formatRentas(payload.legalPersonData.rentas)}`,
    );
    addParagraph(
      `Representante: ${
        payload.legalPersonData.representative.fullName || "-"
      } (${payload.legalPersonData.representative.dni || "sin DNI"})`,
    );
    addParagraph(
      `PEP representante: ${formatPep(
        payload.legalPersonData.isPep,
        payload.legalPersonData.pepReason,
      )}`,
    );
  }

  addSection("Documentos enviados PF");
  addParagraph(
    `DNI frente: ${formatDocs(payload.documentsMeta.natural.dniFront)}`,
  );
  addParagraph(
    `DNI dorso: ${formatDocs(payload.documentsMeta.natural.dniBack)}`,
  );
  addParagraph(`Constancia CBU: ${formatDocs(payload.documentsMeta.natural.cbu)}`);
  addParagraph(`AFIP / ARCA: ${formatDocs(payload.documentsMeta.natural.afip)}`);
  addParagraph(`Rentas: ${formatDocs(payload.documentsMeta.natural.rentas)}`);

  addSection("Documentos enviados PJ");
  addParagraph(
    `DNI representante frente: ${formatDocs(
      payload.documentsMeta.legal.dniRepresentativeFront,
    )}`,
  );
  addParagraph(
    `DNI representante dorso: ${formatDocs(
      payload.documentsMeta.legal.dniRepresentativeBack,
    )}`,
  );
  addParagraph(
    `Constancia CUIT: ${formatDocs(payload.documentsMeta.legal.companyCuit)}`,
  );
  addParagraph(
    `Constancia CBU: ${formatDocs(payload.documentsMeta.legal.companyCbu)}`,
  );
  addParagraph(
    `Contrato / estatuto: ${formatDocs(payload.documentsMeta.legal.bylaws)}`,
  );
  addParagraph(`Rentas: ${formatDocs(payload.documentsMeta.legal.rentas)}`);

  const fileNameBase = payload.basicData.fantasyName
    ? payload.basicData.fantasyName.replace(/[^a-z0-9-_]+/gi, "-")
    : "solicitud-zoco";
  doc.save(`${fileNameBase || "solicitud-zoco"}.pdf`);
};
