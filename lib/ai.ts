import OpenAI from "openai";
import type { ParsedVacancy } from "./parseVacancy";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.aitunnel.ru/v1",
});

export type ResumeRewriteItem = {
  original: string;
  rewritten: string;
};

export type AnalyzeResult = {
  fit_score: number;
  match_level: "strong" | "medium" | "low";
  strengths: string[];
  gaps: string[];
  cover_letter: string;
  tailored_summary: string;
  resume_highlights: string[];
  resume_rewrites: ResumeRewriteItem[];
};

export async function analyzeResumeAndVacancy(params: {
  resumeText: string;
  vacancy: ParsedVacancy;
  aboutMe?: string;
}): Promise<AnalyzeResult> {
  const { resumeText, vacancy, aboutMe = "" } = params;

  const prompt = `
Ты сильный карьерный редактор, executive writer и advisor по откликам.

Тебе даны:
1) текст вакансии
2) текст резюме кандидата
3) дополнительный текст "о себе", который кандидат сохранил в профиле

Твоя задача:
1. Оцени соответствие кандидата вакансии.
2. Выдай fit_score от 0 до 100.
3. Определи match_level: strong, medium или low.
4. Напиши 3 сильных совпадения.
5. Напиши 3 риска / пробела.
6. Напиши сопроводительное письмо на русском языке.
7. Напиши strong tailored_summary для верхнего блока резюме.
8. Выдели 4-6 акцентов, которые нужно усилить в резюме под эту вакансию.
9. Сгенерируй 3-5 пар "original → rewritten".

Критично важно:
- НЕ выдумывай факты.
- НЕ меняй цифры, проценты, количество точек, брендов, лет, размер команды, названия компаний и партнёров.
- Используй только факты из резюме и текста "о себе".
- Если в "о себе" есть релевантные достижения, используй их.
- Не используй штампы и канцелярит.
- Не добавляй приветствие и подпись.
- Тон: уверенный, взрослый, конкретный.

Верни ТОЛЬКО валидный JSON:
{
  "fit_score": 0,
  "match_level": "strong",
  "strengths": ["", "", ""],
  "gaps": ["", "", ""],
  "cover_letter": "",
  "tailored_summary": "",
  "resume_highlights": ["", "", "", ""],
  "resume_rewrites": [
    { "original": "", "rewritten": "" }
  ]
}
`.trim();

  const input = `
ВАКАНСИЯ
Название: ${vacancy.title}
Компания: ${vacancy.company}
Ссылка: ${vacancy.url}

Описание вакансии:
${vacancy.description}

РЕЗЮМЕ:
${resumeText}

О СЕБЕ / ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:
${aboutMe || "Нет"}
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: input },
    ],
    temperature: 0.35,
    response_format: { type: "json_object" },
  });

  const rawText = completion.choices[0]?.message?.content?.trim();

  if (!rawText) {
    throw new Error("Пустой ответ от модели");
  }

  let parsed: Partial<AnalyzeResult>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Не удалось распарсить JSON от модели");
  }

  return normalizeAnalyzeResult(parsed);
}

function normalizeAnalyzeResult(result: Partial<AnalyzeResult>): AnalyzeResult {
  const fitScore = Number.isFinite(result.fit_score)
    ? Math.max(0, Math.min(100, Math.round(Number(result.fit_score))))
    : 0;

  const matchLevel: AnalyzeResult["match_level"] =
    result.match_level === "strong" ||
    result.match_level === "medium" ||
    result.match_level === "low"
      ? result.match_level
      : fitScore >= 80
      ? "strong"
      : fitScore >= 60
      ? "medium"
      : "low";

  const strengths = toStringArray(result.strengths, 3);
  const gaps = toStringArray(result.gaps, 3);
  const resumeHighlights = toStringArray(result.resume_highlights, 6);

  const rewrites = Array.isArray(result.resume_rewrites)
    ? result.resume_rewrites
        .filter(
          (item): item is ResumeRewriteItem =>
            !!item &&
            typeof item === "object" &&
            typeof item.original === "string" &&
            typeof item.rewritten === "string" &&
            item.original.trim().length > 0 &&
            item.rewritten.trim().length > 0
        )
        .slice(0, 5)
        .map((item) => ({
          original: cleanupText(item.original),
          rewritten: cleanupText(item.rewritten),
        }))
    : [];

  return {
    fit_score: fitScore,
    match_level: matchLevel,
    strengths,
    gaps,
    cover_letter: cleanupText(result.cover_letter ?? ""),
    tailored_summary: cleanupText(result.tailored_summary ?? ""),
    resume_highlights: resumeHighlights,
    resume_rewrites: rewrites,
  };
}

function toStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => cleanupText(item));
}

function cleanupText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}