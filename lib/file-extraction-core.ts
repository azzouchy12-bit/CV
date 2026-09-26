import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 120_000;

export function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/^-- \d+ of \d+ --$/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

export function getFileExtension(fileName: string | null | undefined, contentType: string | null | undefined) {
  const name = fileName?.toLowerCase() ?? "";
  const type = contentType?.toLowerCase().split(";")[0] ?? "";
  const genericType = !type || type === "application/octet-stream";
  if (name) {
    if (name.endsWith(".pdf") && (genericType || type === "application/pdf")) return "pdf";
    if (name.endsWith(".docx") && (genericType || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "docx";
    if (name.endsWith(".txt") && (genericType || type === "text/plain")) return "txt";
    return null;
  }
  if (type === "application/pdf") return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (type === "text/plain") return "txt";
  return null;
}

export async function extractTextFromBuffer(buffer: Buffer, extension: "pdf" | "docx" | "txt") {
  if (extension === "txt") return normalizeExtractedText(buffer.toString("utf8"));
  if (extension === "docx") return normalizeExtractedText((await mammoth.extractRawText({ buffer })).value);

  const parser = new PDFParse({ data: buffer });
  try {
    return normalizeExtractedText((await parser.getText()).text);
  } finally {
    await parser.destroy();
  }
}
