import OpenAI from "openai";
import type { ParsedVacancy } from "./parseVacancy";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.aitunnel.ru/v1"
});

export type AnalyzeResult = {
  fit_score: number;
  match_level: "strong" | "medium" | "low";
  strengths: string[];
  gaps: string[];
  cover_letter: string;
};

export async function analyzeResumeAndVacancy(params: {
  resumeText: string;
  vacancy: ParsedVacancy;
}): Promise<AnalyzeResult> {
  const { resumeText, vacancy } = params;

  const prompt = `
Ты карьерный ассистент. 
Тебе даны:
1) текст вакансии
2) текст резюме кандидата

Задача:
1. Оцени соответствие кандидата вакансии.
2. Выдай fit_score от 0 до 100.
3. Определи уровень match_level: strong, medium или low.
4. Напиши 3 сильных совпадения.
5. Напиши 3 пробела / риска.
6. Напиши короткое сопроводительное письмо на русском языке:
   - уверенное
   - без воды
   - без штампов вроде "ответственный", "стрессоустойчивый", "командный игрок"
   - не выдумывай опыт
   - в начале письма уже должен быть короткий summary на 1-2 предложения
   - длина письма: примерно 700-1200 знаков

Верни ТОЛЬКО валидный JSON в таком формате:
{
  "fit_score": 0,
  "match_level": "strong",
  "strengths": ["", "", ""],
  "gaps": ["", "", ""],
  "cover_letter": ""
}

Если данных не хватает, делай аккуратные выводы только из текста.
`;

  const input = `
ВАКАНСИЯ
Название: ${vacancy.title}
Компания: ${vacancy.company}
Ссылка: ${vacancy.url}

Описание вакансии:
${vacancy.description}

РЕЗЮМЕ
${resumeText}
`;

  const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
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
  temperature: 0.7,
});

const rawText = completion.choices[0]?.message?.content || "";

  let parsed: AnalyzeResult;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Не удалось распарсить ответ модели");
  }

  return normalizeAnalyzeResult(parsed);
}

function getTextFromResponse(response: OpenAI.Responses.Response): string {
  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("Пустой ответ от модели");
  }
  return text;
}

function normalizeAnalyzeResult(result: AnalyzeResult): AnalyzeResult {
  const fitScore = Number.isFinite(result.fit_score)
    ? Math.max(0, Math.min(100, Math.round(result.fit_score)))
    : 0;

  const matchLevel: AnalyzeResult["match_level"] =
    result.match_level === "strong" ||
    result.match_level === "medium" ||
    result.match_level === "low"
      ? result.match_level
      : fitScore >= 70
      ? "strong"
      : fitScore >= 45
      ? "medium"
      : "low";

  return {
    fit_score: fitScore,
    match_level: matchLevel,
    strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
    gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 3) : [],
    cover_letter: typeof result.cover_letter === "string" ? result.cover_letter.trim() : "",
  };
}
