import type { TransactionType } from "@/types/transaction.types";

/**
 * Parser de notificaciones/SMS de bancos colombianos.
 *
 * Contexto de producto: se descartó interceptar SMS en background (ver
 * `memory/share-transaction-decision.md`) — el usuario comparte manualmente
 * el texto del mensaje desde su app nativa (share sheet) y este módulo lo
 * interpreta para prellenar el formulario de "confirmar transacción".
 *
 * Debe ser tolerante a mensajes desconocidos: nunca lanza, siempre devuelve
 * un `ParsedBankMessage` con los campos que pudo inferir (o ninguno).
 */

export type DetectedBank =
  | "bancolombia"
  | "nequi"
  | "daviplata"
  | "davivienda"
  | "banco_de_bogota"
  | "bbva"
  | "unknown";

export interface ParsedBankMessage {
  bank: DetectedBank;
  /** Monto en COP, sin separadores. `null` si no se pudo extraer. */
  amount: number | null;
  /** Fecha ISO `YYYY-MM-DD` si el mensaje trae fecha reconocible, si no `null`. */
  date: string | null;
  /** Hora `HH:mm` si el mensaje la trae, si no `null`. */
  time: string | null;
  /** Comercio, beneficiario o remitente detectado en el texto. */
  counterparty: string | null;
  /** Tipo de movimiento inferido para prellenar `CreateTransactionRecordDto.type`. */
  type: TransactionType | null;
  /** Texto original, siempre se conserva para depurar/editar a mano. */
  rawText: string;
}

const MONTHS_ES: Record<string, string> = {
  ene: "01",
  enero: "01",
  feb: "02",
  febrero: "02",
  mar: "03",
  marzo: "03",
  abr: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  jun: "06",
  junio: "06",
  jul: "07",
  julio: "07",
  ago: "08",
  agosto: "08",
  sep: "09",
  sept: "09",
  septiembre: "09",
  oct: "10",
  octubre: "10",
  nov: "11",
  noviembre: "11",
  dic: "12",
  diciembre: "12",
};

function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Convierte "26/04/2026", "26/04/26" o "26-abr-2026" a "YYYY-MM-DD". */
function parseDate(text: string): string | null {
  // dd/mm/yyyy o dd/mm/yy o dd-mm-yyyy
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // dd-MMM-yyyy (ej. "26-ABR-2026" o "26 abr 2026")
  const withMonthName = text.match(
    /\b(\d{1,2})[\s-]+([a-zA-ZñÑ]{3,})[\s.-]*(\d{2,4})?\b/,
  );
  if (withMonthName) {
    const [, d, monthRaw, y] = withMonthName;
    const month = MONTHS_ES[monthRaw.toLowerCase()];
    if (month) {
      const year = y ? (y.length === 2 ? `20${y}` : y) : currentYear();
      return `${year}-${month}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

/** Extrae "HH:mm" (24h o 12h con am/pm) del texto. */
function parseTime(text: string): string | null {
  const match = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|hrs|h)?\b/i);
  if (!match) return null;
  let [, h, m, suffix] = match;
  let hour = parseInt(h, 10);
  if (suffix?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (suffix?.toLowerCase() === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

/** Extrae el primer monto en formato colombiano ($123.456,78 o $123,456.78 o $123456). */
function parseAmount(text: string): number | null {
  const match = text.match(/\$\s*([\d.,]+)/);
  if (!match) return null;
  let raw = match[1];
  // Quita separador de miles y normaliza decimal a "."
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma > lastDot) {
    // "," es el decimal, "." son miles
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // "." es el decimal solo si quedan <=2 dígitos después, si no es miles
    const decimals = raw.length - lastDot - 1;
    if (decimals <= 2 && raw.slice(lastDot + 1).length <= 2) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(/[.,]/g, "");
    }
  } else {
    raw = raw.replace(/[.,]/g, "");
  }
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function detectBank(text: string): DetectedBank {
  const t = text.toLowerCase();
  if (t.includes("bancolombia")) return "bancolombia";
  if (t.includes("nequi")) return "nequi";
  if (t.includes("daviplata")) return "daviplata";
  if (t.includes("davivienda")) return "davivienda";
  if (t.includes("banco de bogot") || t.includes("bancodebogota")) return "banco_de_bogota";
  if (t.includes("bbva")) return "bbva";
  return "unknown";
}

function detectType(text: string): TransactionType | null {
  const t = text.toLowerCase();
  if (/(recibiste|recibio|recibió|te enviaron|abono|abonaron|consignación|consignacion)/.test(t)) {
    return "income";
  }
  if (/(compra|pagaste|pago en|pago a|pago por|realizaste una compra)/.test(t)) {
    return "expense";
  }
  if (/(enviaste|transferencia enviada|envio de dinero|envío de dinero|giraste)/.test(t)) {
    return "expense";
  }
  if (/transferencia/.test(t)) {
    // Sin dirección explícita: no se puede asumir el tipo con confianza.
    return null;
  }
  return null;
}

// Corta la captura del comercio/beneficiario antes de la fecha ("el 26/04...")
// o de otras preposiciones de contexto — el lookahead exige un dígito después
// de "el" para no cortar nombres de comercio legítimos como "EL TESORO"/"EL
// CORTE INGLES" (que también contienen la palabra "el").
const STOP_LOOKAHEAD = String.raw`(?=\s+el\s+\d|\s+(?:por|desde|con)\b|[.,\n]|$)`;

/** Comercio/beneficiario para mensajes de Bancolombia ("...en ESTABLECIMIENTO", "a NOMBRE"). */
function parseCounterpartyBancolombia(text: string): string | null {
  const compra = text.match(
    new RegExp(String.raw`compra[^$]{0,20}\$[\d.,]+\s+en\s+([^.,\n]+?)${STOP_LOOKAHEAD}`, "i"),
  );
  if (compra) return compra[1].trim();
  const a = text.match(
    new RegExp(String.raw`\ba\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\s]{2,40}?)${STOP_LOOKAHEAD}`),
  );
  if (a) return a[1].trim();
  const de = text.match(
    new RegExp(String.raw`\bde\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\s]{2,40}?)${STOP_LOOKAHEAD}`),
  );
  if (de) return de[1].trim();
  return null;
}

/** Comercio/beneficiario para mensajes de Nequi ("Enviaste $X a NOMBRE", "Recibiste $X de NOMBRE"). */
function parseCounterpartyNequi(text: string): string | null {
  const match = text.match(
    new RegExp(String.raw`\b(?:a|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ*\s]{2,40}?)${STOP_LOOKAHEAD}`, "i"),
  );
  if (match) return match[1].trim();
  return null;
}

/**
 * Parsea un mensaje bancario colombiano. Nunca lanza: si nada matchea,
 * devuelve todos los campos en `null`/`unknown` con `rawText` intacto para
 * que el usuario complete el formulario a mano (fallback obligatorio).
 */
export function parseBankMessage(rawText: string): ParsedBankMessage {
  const text = (rawText ?? "").trim();
  const bank = detectBank(text);
  const amount = parseAmount(text);
  const date = parseDate(text);
  const time = parseTime(text);
  const type = detectType(text);

  let counterparty: string | null = null;
  if (bank === "bancolombia") {
    counterparty = parseCounterpartyBancolombia(text);
  } else if (bank === "nequi") {
    counterparty = parseCounterpartyNequi(text);
  } else {
    // Bancos aún no soportados con reglas propias: reusa el parser genérico
    // de Nequi/Bancolombia (misma forma "a/de NOMBRE") como mejor esfuerzo.
    counterparty = parseCounterpartyNequi(text) ?? parseCounterpartyBancolombia(text);
  }

  return { bank, amount, date, time, counterparty, type, rawText: text };
}
