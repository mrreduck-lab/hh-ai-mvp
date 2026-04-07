import { NextResponse } from "next/server";
import { parseResumeFile } from "@/lib/parseResume";
import { parseVacancyFromUrl } from "@/lib/parseVacancy";
import { analyzeResumeAndVacancy } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const vacancyUrl = String(formData.get("vacancyUrl") || "").trim();
    const resumeFile = formData.get("resumeFile");

    if (!vacancyUrl) {
      return NextResponse.json(
        { error: "Добавь ссылку на вакансию hh.ru" },
        { status: 400 }
      );
    }

    if (!(resumeFile instanceof File)) {
      return NextResponse.json(
        { error: "Загрузи резюме в PDF, DOCX или TXT" },
        { status: 400 }
      );
    }

    const [resumeText, vacancy] = await Promise.all([
      parseResumeFile(resumeFile),
      parseVacancyFromUrl(vacancyUrl),
    ]);

    if (!resumeText || resumeText.length < 100) {
      return NextResponse.json(
        { error: "Не удалось нормально прочитать резюме" },
        { status: 400 }
      );
    }

    const analysis = await analyzeResumeAndVacancy({
      resumeText,
      vacancy,
    });

    return NextResponse.json({
      vacancy,
      analysis,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Что-то пошло не так";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
