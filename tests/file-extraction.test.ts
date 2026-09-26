import assert from "node:assert/strict";
import { test } from "node:test";
import { extractTextFromBuffer, getFileExtension } from "../lib/file-extraction-core.ts";

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(files: Array<[string, string]>) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of files) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(value);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    local.push(header, nameBuffer, data);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc32(data), 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(nameBuffer.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBuffer);
    offset += header.length + nameBuffer.length + data.length;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

function makeTextPdf(text: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length + 35} >>\nstream\nBT /F1 12 Tf 20 100 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("extracts normalized TXT text", async () => {
  assert.equal(await extractTextFromBuffer(Buffer.from("Name   Test\n\n\nSkills  TypeScript"), "txt"), "Name Test\n\nSkills TypeScript");
});

test("extracts DOCX paragraph text", async () => {
  const documentXml = "<?xml version=\"1.0\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Candidate Name</w:t></w:r></w:p><w:p><w:r><w:t>Project Manager</w:t></w:r></w:p></w:body></w:document>";
  const text = await extractTextFromBuffer(makeStoredZip([["word/document.xml", documentXml]]), "docx");
  assert.match(text, /Candidate Name/);
  assert.match(text, /Project Manager/);
});

test("extracts text-based PDF text", async () => {
  assert.match(await extractTextFromBuffer(makeTextPdf("Candidate Name"), "pdf"), /Candidate Name/);
});

test("returns empty text for a valid PDF without extractable text", async () => {
  assert.equal(await extractTextFromBuffer(makeTextPdf(""), "pdf"), "");
});

test("detects unsupported, missing, and empty extraction inputs", async () => {
  assert.equal(getFileExtension("cv.rtf", "application/rtf"), null);
  assert.equal(getFileExtension("cv.pdf", "application/octet-stream"), "pdf");
  assert.equal(getFileExtension("payload.exe", "application/pdf"), null);
  assert.equal(getFileExtension("cv.pdf", "image/jpeg"), null);
  assert.equal(await extractTextFromBuffer(Buffer.from("   \n\n  "), "txt"), "");
});
