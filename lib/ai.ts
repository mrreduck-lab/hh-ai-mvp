import OpenAI from "openai";
import type { ParsedVacancy } from "./parseVacancy";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.aitunnel.ru/v1",
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
Ты сильный карьерный редактор, executive resume writer и advisor по откликам на вакансии.

Тебе даны:
1) текст вакансии
2) текст резюме кандидата

Твоя задача:
1. Оцени соответствие кандидата вакансии.
2. Выдай fit_score от 0 до 100.
3. Определи match_level: strong, medium или low.
4. Напиши 3 сильных совпадения кандидата с вакансией.
5. Напиши 3 пробела / риска.
6. Напиши сопроводительное письмо на русском языке.

Критично важно:
- НЕ выдумывай опыт, цифры, названия компаний, навыки, индустрии, роли и достижения.
- Используй только те факты, которые явно есть в резюме.
- Перед написанием письма выбери только 2-3 самых сильных и релевантных достижения кандидата под эту вакансию.
- Если в резюме есть конкретные цифры, проценты, масштабы бизнеса, число точек, брендов, размер команды, партнёры или KPI — обязательно используй их.
- НЕ перечисляй всё резюме.
- НЕ используй пустые фразы и штампы:
  "ответственный", "командный игрок", "стрессоустойчивый", "мотивирован", "быстро обучаюсь",
  "уверен, что мой опыт поможет", "заинтересован в позиции", "обладаю богатым опытом".
- НЕ пиши канцеляритом и пафосом.
- Если есть пробелы, не делай на них акцент в письме. Акцентируй релевантные сильные стороны.
- Письмо должно быть коротким, плотным, конкретным и живым.
- В начале письма должен быть короткий summary на 1-2 предложения.
- Общая длина письма: 600-1100 знаков.
- Тон: уверенный, взрослый, спокойный.
- Письмо должно звучать как сообщение сильного кандидата, а не как шаблон от нейросети.
- Не добавляй приветствие "Меня зовут ...", если это не усиливает письмо.
- Не добавляй "С уважением" и подпись.

Структура письма:
1. Короткий summary: кто кандидат и в чём его релевантность этой роли
2. Почему именно этот опыт релевантен данной вакансии
3. 1-2 самых сильных доказательства с цифрами и фактами
4. Короткое завершение в 1 предложении

Правила fit_score:
- 80-100 = сильное соответствие, если есть прямой релевантный опыт, уровень и часть ключевых задач
- 60-79 = хорошее/среднее соответствие, если релевантность есть, но не полная
- 0-59 = слабое соответствие

Верни ТОЛЬКО валидный JSON:
{
  "fit_score": 0,
  "match_level": "strong",
  "strengths": ["", "", ""],
  "gaps": ["", "", ""],
  "cover_letter": ""
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
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const rawText = completion.choices[0]?.message?.content?.trim();

  if (!rawText) {
    throw new Error("Пустой ответ от модели");
  }

  let parsed: AnalyzeResult;
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

  const strengths = Array.isArray(result.strengths)
    ? result.strengths
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 3)
    : [];

  const gaps = Array.isArray(result.gaps)
    ? result.gaps
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 3)
    : [];

  const coverLetter =
    typeof result.cover_letter === "string" ? cleanupCoverLetter(result.cover_letter) : "";

  return {
    fit_score: fitScore,
    match_level: matchLevel,
    strengths,
    gaps,
    cover_letter: coverLetter,
  };
}

function cleanupCoverLetter(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}