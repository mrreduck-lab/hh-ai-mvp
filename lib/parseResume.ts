import pdf from "pdf-parse";
import mammoth from "mammoth";

export async function parseResumeFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    const result = await pdf(buffer);
    return cleanText(result.text);
  }

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value);
  }

  if (fileName.endsWith(".txt")) {
    return cleanText(buffer.toString("utf-8"));
  }

  throw new Error("Поддерживаются только PDF, DOCX и TXT");
}

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
