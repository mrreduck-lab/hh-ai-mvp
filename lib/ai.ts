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
}): Promise<AnalyzeResult> {
  const { resumeText, vacancy } = params;

  const prompt = `
Ты сильный карьерный редактор, executive writer и advisor по откликам.

Тебе даны:
1) текст вакансии
2) текст резюме кандидата

Твоя задача:
1. Оцени соответствие кандидата вакансии.
2. Выдай fit_score от 0 до 100.
3. Определи match_level: strong, medium или low.
4. Напиши 3 сильных совпадения.
5. Напиши 3 риска / пробела.
6. Напиши сопроводительное письмо на русском языке.
7. Напиши сильный tailored_summary для верхнего блока резюме под эту вакансию.
8. Выдели 4-6 ключевых акцентов, которые нужно усилить в резюме под эту вакансию.
9. Сгенерируй 3-5 пар "original → rewritten":
   - original = короткая исходная формулировка на основе резюме
   - rewritten = более сильная и релевантная формулировка под вакансию
   - rewritten должна быть конкретной, с цифрами, если они есть в резюме
   - нельзя выдумывать факты

Критично важно:
- НЕ выдумывай опыт, цифры, проценты, количество точек, брендов, размер команды, названия компаний и партнёров.
- НЕ меняй цифры и факты из резюме.
- Если в резюме нет точной цифры, не подставляй приблизительную.
- Используй только факты, которые явно есть в резюме.
- Перед письмом и summary мысленно выбери только 2-3 самых сильных достижения кандидата под эту вакансию.
- Если в резюме есть конкретные KPI и масштабы, используй минимум 2 из них в письме или summary.
- НЕ перечисляй всё резюме.
- НЕ используй пустые штампы:
  "ответственный", "командный игрок", "стрессоустойчивый", "мотивирован", "уверен, что мой опыт поможет", "заинтересован в позиции", "обладаю богатым опытом".
- НЕ пиши канцеляритом.
- Не добавляй приветствие, подпись и "с уважением".
- Тон: уверенный, взрослый, спокойный, конкретный.
- Сопроводительное письмо: 650-1100 знаков.
- tailored_summary: 280-500 знаков.
- Письмо и summary должны звучать как текст сильного кандидата, а не шаблон нейросети.

Правила fit_score:
- 80-100 = сильное соответствие
- 60-79 = хорошее / среднее соответствие
- 0-59 = слабое соответствие

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
    {
      "original": "",
      "rewritten": ""
    }
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

РЕЗЮМЕ КАНДИДАТА:
${resumeText}

ВАЖНО:
- Используй только факты из резюме.
- Не изменяй цифры и масштабы.
- Если в резюме написано 40+ точек, нельзя писать 30.
- Если в резюме есть сильные KPI, используй их в письме, summary и rewritten bullets.
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: input,
      },
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