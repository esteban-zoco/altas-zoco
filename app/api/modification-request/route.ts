import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import {
  type ModificationRequestValues,
  modificationRequestSchema,
} from "@/lib/modificationRequestSchema";

const changeTypeLabels = {
  fantasyName: "Nombre de fantasía",
  paymentAccount: "Boca de pago",
  address: "Dirección comercial",
} satisfies Record<ModificationRequestValues["changeTypes"][number], string>;

interface EmailContext {
  paymentProofNames: string[];
}

const formatAddress = (
  address: ModificationRequestValues["addressCurrent"],
) => {
  const streetLine = [address.street, address.number].filter(Boolean).join(" ").trim();
  const cityLine = [address.city, address.province].filter(Boolean).join(", ").trim();
  const postal = address.postalCode ? `CP ${address.postalCode}` : "";
  return [streetLine, address.floor, cityLine, postal]
    .filter((value) => Boolean(value && value !== ""))
    .join(" - ") || "-";
};

const buildHtml = (
  payload: ModificationRequestValues,
  context: EmailContext = { paymentProofNames: [] },
) => {
  const sections: string[] = [];

  if (payload.changeTypes.includes("fantasyName")) {
    sections.push(`
      <h3>Nombre de fantasía</h3>
      <ul>
        <li>Actual: ${payload.fantasyNameCurrent}</li>
        <li>Nuevo: ${payload.fantasyNameNew}</li>
      </ul>
    `);
  }

  if (payload.changeTypes.includes("paymentAccount")) {
    sections.push(`
      <h3>Boca de pago</h3>
      <ul>
        <li>Alias/CBU anterior: ${payload.paymentCurrentIdentifier || "-"}</li>
        <li>Nuevo alias o CBU: ${payload.paymentNewIdentifier}</li>
        <li>Titular: ${payload.paymentHolderName} (${payload.paymentHolderDocument})</li>
        <li>Notas: ${payload.paymentNotes || "-"}</li>
        <li>Constancias adjuntas: ${
          context.paymentProofNames.length
            ? context.paymentProofNames.join(", ")
            : "Sin archivos"
        }</li>
      </ul>
    `);
  }

  if (payload.changeTypes.includes("address")) {
    sections.push(`
      <h3>Dirección comercial</h3>
      <ul>
        <li>Local/sucursal: ${payload.addressStoreReference}</li>
        <li>Dirección actual: ${formatAddress(payload.addressCurrent)}</li>
        <li>Nueva dirección: ${formatAddress(payload.addressNew)}</li>
      </ul>
    `);
  }

  return `
    <h1>Solicitud de modificación de datos</h1>
    <p>
      Comercio: <strong>${payload.fantasyName}</strong><br/>
      CUIT: ${payload.cuit}<br/>
      Contacto: ${payload.contactEmail} - ${payload.contactPhone}<br/>
      Cambios solicitados: ${payload.changeTypes
        .map((type) => changeTypeLabels[type])
        .join(", ")}
    </p>
    ${sections.join("")}
  `;
};

const buildText = (
  payload: ModificationRequestValues,
  context: EmailContext = { paymentProofNames: [] },
) => {
  const lines: string[] = [
    "Solicitud de modificación de datos",
    `Comercio: ${payload.fantasyName}`,
    `CUIT: ${payload.cuit}`,
    `Contacto: ${payload.contactEmail} - ${payload.contactPhone}`,
    `Cambios solicitados: ${payload.changeTypes
      .map((type) => changeTypeLabels[type])
      .join(", ")}`,
    "",
  ];

  if (payload.changeTypes.includes("fantasyName")) {
    lines.push(
      "Nombre de fantasía:",
      `Actual: ${payload.fantasyNameCurrent}`,
      `Nuevo: ${payload.fantasyNameNew}`,
      "",
    );
  }

  if (payload.changeTypes.includes("paymentAccount")) {
    lines.push(
      "Boca de pago:",
      `Anterior: ${payload.paymentCurrentIdentifier || "-"}`,
      `Nuevo alias/CBU: ${payload.paymentNewIdentifier}`,
      `Titular: ${payload.paymentHolderName} (${payload.paymentHolderDocument})`,
      `Notas: ${payload.paymentNotes || "-"}`,
      `Constancias adjuntas: ${
        context.paymentProofNames.length
          ? context.paymentProofNames.join(", ")
          : "Sin archivos"
      }`,
      "",
    );
  }

  if (payload.changeTypes.includes("address")) {
    lines.push(
      "Dirección comercial:",
      `Sucursal: ${payload.addressStoreReference}`,
      `Actual: ${formatAddress(payload.addressCurrent)}`,
      `Nueva: ${formatAddress(payload.addressNew)}`,
      "",
    );
  }

  return lines.join("\n");
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");
    if (!payloadRaw || typeof payloadRaw !== "string") {
      return NextResponse.json(
        { success: false, error: "No recibimos datos para procesar la solicitud" },
        { status: 400 },
      );
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json(
        { success: false, error: "El formato de datos enviados no es válido" },
        { status: 400 },
      );
    }

    const parsed = modificationRequestSchema.safeParse(parsedPayload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Revisá los datos ingresados",
          details: parsed.error.flatten(),
        },
        { status: 422 },
      );
    }

    const payload = parsed.data;
    const paymentProofEntries = formData
      .getAll("paymentProofs")
      .filter((item): item is File => item instanceof File);
    const attachments: {
      filename: string;
      content: string;
      encoding: "base64";
    }[] = [];
    const paymentProofNames: string[] = [];

    for (const [index, file] of paymentProofEntries.entries()) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename =
        file.name?.trim() && file.name.length > 0
          ? file.name
          : `constancia-cbu-${index + 1}.pdf`;
      paymentProofNames.push(filename);
      attachments.push({
        filename,
        content: buffer.toString("base64"),
        encoding: "base64" as const,
      });
    }

    const host = process.env.EMAIL_SMTP_HOST;
    const port = process.env.EMAIL_SMTP_PORT;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS ?? process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM ?? "no-responder@zocoaltas.com.ar";

    if (!host || !port || !user || !pass) {
      return NextResponse.json(
        { success: false, error: "No está configurado el servicio de email" },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `Zoco Altas <${fromEmail}>`,
      to: "altas@zocoweb.com.ar",
      subject: `Modificación de datos - ${payload.fantasyName}`,
      text: buildText(payload, { paymentProofNames }),
      html: buildHtml(payload, { paymentProofNames }),
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando solicitud de modificación", error);
    return NextResponse.json(
      { success: false, error: "No pudimos enviar tu solicitud" },
      { status: 500 },
    );
  }
}
