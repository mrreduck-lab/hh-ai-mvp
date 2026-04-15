import { NextResponse } from "next/server";
import { parseResumeFile } from "@/lib/parseResume";
import { parseVacancyFromUrl } from "@/lib/parseVacancy";
import { analyzeResumeAndVacancy } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const vacancyUrl = String(formData.get("vacancyUrl") || "").trim();
    const aboutMe = String(formData.get("aboutMe") || "").trim();
    const resumeFile = formData.get("resumeFile");

    if (!vacancyUrl) {
      return NextResponse.json(
        { error: "Добавь ссылку на вакансию hh.ru" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let savedResumeText = "";
    let savedAboutMe = "";

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("resume_text, about_me")
        .eq("id", user.id)
        .maybeSingle();

      savedResumeText = profile?.resume_text || "";
      savedAboutMe = profile?.about_me || "";
    }

    let resumeText = savedResumeText;

    if (resumeFile instanceof File && resumeFile.size > 0) {
      resumeText = await parseResumeFile(resumeFile);
    }

    if (!resumeText || resumeText.length < 100) {
      return NextResponse.json(
        { error: "Загрузи резюме или сохрани его в личном кабинете" },
        { status: 400 }
      );
    }

    const vacancy = await parseVacancyFromUrl(vacancyUrl);

    const mergedAbout = [savedAboutMe, aboutMe].filter(Boolean).join("\n\n");

    const analysis = await analyzeResumeAndVacancy({
      resumeText,
      vacancy,
      aboutMe: mergedAbout,
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