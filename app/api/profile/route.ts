import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseResumeFile } from "@/lib/parseResume";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, about_me, resume_file_path, resume_text")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Нужно войти в аккаунт" }, { status: 401 });
  }

  const formData = await request.formData();
  const fullName = String(formData.get("fullName") || "").trim();
  const aboutMe = String(formData.get("aboutMe") || "").trim();
  const resumeFile = formData.get("resumeFile");

  let resumeFilePath: string | undefined;
  let resumeText: string | undefined;

  if (resumeFile instanceof File && resumeFile.size > 0) {
    resumeText = await parseResumeFile(resumeFile);

    const extension = getExtension(resumeFile.name);
    const filePath = `${user.id}/resume.${extension}`;

    const uploadResult = await admin.storage.from("resumes").upload(filePath, resumeFile, {
      upsert: true,
      contentType: resumeFile.type || "application/octet-stream",
    });

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    resumeFilePath = filePath;
  }

  const payload: {
    id: string;
    full_name: string;
    about_me: string;
    updated_at: string;
    resume_file_path?: string;
    resume_text?: string;
  } = {
    id: user.id,
    full_name: fullName,
    about_me: aboutMe,
    updated_at: new Date().toISOString(),
  };

  if (resumeFilePath) payload.resume_file_path = resumeFilePath;
  if (resumeText) payload.resume_text = resumeText;

  const { error } = await admin.from("profiles").upsert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function getExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  return "bin";
}