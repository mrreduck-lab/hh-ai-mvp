"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AnalyzeResponse = {
  vacancy: {
    title: string;
    company: string;
    description: string;
    url: string;
  };
  analysis: {
    fit_score: number;
    match_level: "strong" | "medium" | "low";
    strengths: string[];
    gaps: string[];
    cover_letter: string;
    tailored_summary: string;
    resume_highlights: string[];
    resume_rewrites: {
      original: string;
      rewritten: string;
    }[];
  };
};

type UserSession = {
  id: string;
  email?: string;
} | null;

type Profile = {
  full_name?: string | null;
  about_me?: string | null;
  resume_file_path?: string | null;
  resume_text?: string | null;
} | null;

const supabase = createClient();

export default function HomePage() {
  const [vacancyUrl, setVacancyUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [aboutMe, setAboutMe] = useState("");
  const [fullName, setFullName] = useState("");

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [user, setUser] = useState<UserSession>(null);
  const [profile, setProfile] = useState<Profile>(null);

  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const [copiedCover, setCopiedCover] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await loadSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadSession() {
    const sessionRes = await fetch("/api/auth/session");
    const sessionJson = await sessionRes.json();
    setUser(sessionJson.user);

    if (sessionJson.user) {
      const profileRes = await fetch("/api/profile");
      const profileJson = await profileRes.json();
      setProfile(profileJson.profile);
      setFullName(profileJson.profile?.full_name || "");
      setAboutMe(profileJson.profile?.about_me || "");
    } else {
      setProfile(null);
      setFullName("");
      setAboutMe("");
    }
  }

  async function signUp() {
    setAuthError("");
    setAuthLoading(true);

    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthError("Проверь почту и подтверди регистрацию, если письмо пришло.");
  }

  async function signIn() {
    setAuthError("");
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setResult(null);
  }

  async function saveProfile() {
    if (!user) {
      setProfileMessage("Сначала войди в аккаунт");
      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage("");

      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("aboutMe", aboutMe);

      if (resumeFile) {
        formData.append("resumeFile", resumeFile);
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Не удалось сохранить профиль");
      }

      setProfileMessage("Профиль сохранён");
      setResumeFile(null);
      await loadSession();
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setCopiedCover(false);
    setCopiedSummary(false);

    if (!vacancyUrl.trim()) {
      setError("Добавь ссылку на вакансию hh.ru");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("vacancyUrl", vacancyUrl.trim());
      formData.append("aboutMe", aboutMe);

      if (resumeFile) {
        formData.append("resumeFile", resumeFile);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Ошибка анализа");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, type: "cover" | "summary") {
    await navigator.clipboard.writeText(text);
    if (type === "cover") {
      setCopiedCover(true);
      setTimeout(() => setCopiedCover(false), 1500);
    } else {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1500);
    }
  }

  const matchMeta = useMemo(() => {
    const level = result?.analysis.match_level;
    if (level === "strong") {
      return {
        label: "Strong match",
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      };
    }
    if (level === "medium") {
      return {
        label: "Medium match",
        chip: "bg-amber-50 text-amber-700 ring-amber-200",
      };
    }
    return {
      label: "Low match",
      chip: "bg-red-50 text-red-700 ring-red-200",
    };
  }, [result]);

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <section className="mb-8 md:mb-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-medium tracking-wide text-[#6e6e73]">
              HH AI Copilot MVP
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Личный кабинет кандидата
            </h1>
            <p className="mt-4 text-base leading-7 text-[#6e6e73] md:text-lg">
              Сохрани резюме и контекст о себе один раз и используй это в каждом отклике.
            </p>
          </div>
        </section>

        {!user ? (
          <section className="mx-auto mb-8 max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Вход / регистрация</h2>
            <div className="mt-6 grid gap-4">
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 outline-none"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={signIn}
                  disabled={authLoading}
                  className="rounded-full bg-[#0071e3] px-5 py-3 text-sm font-medium text-white"
                >
                  Войти
                </button>
                <button
                  onClick={signUp}
                  disabled={authLoading}
                  className="rounded-full border border-black/10 px-5 py-3 text-sm font-medium"
                >
                  Зарегистрироваться
                </button>
              </div>
              {authError && (
                <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm text-[#6e6e73]">
                  {authError}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="mx-auto mb-8 max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Мой профиль</h2>
                <p className="mt-2 text-sm text-[#6e6e73]">{user.email}</p>
              </div>
              <button
                onClick={signOut}
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-medium"
              >
                Выйти
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Имя"
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 outline-none"
              />

              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder="О себе: кейсы, достижения, цифры, контекст, что важно учитывать в откликах"
                rows={8}
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 outline-none"
              />

              <div>
                <label className="mb-3 block text-sm font-medium text-[#1d1d1f]">
                  Резюме
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-[#6e6e73]"
                />
                {profile?.resume_file_path && !resumeFile && (
                  <p className="mt-3 text-sm text-[#6e6e73]">
                    Сохранённое резюме уже есть
                  </p>
                )}
                {resumeFile && (
                  <p className="mt-3 text-sm text-[#6e6e73]">
                    Новый файл: {resumeFile.name}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white"
                >
                  {savingProfile ? "Сохраняем..." : "Сохранить профиль"}
                </button>
              </div>

              {profileMessage && (
                <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm text-[#6e6e73]">
                  {profileMessage}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-[#1d1d1f]">
                Ссылка на вакансию hh.ru
              </label>
              <input
                type="url"
                value={vacancyUrl}
                onChange={(e) => setVacancyUrl(e.target.value)}
                placeholder="https://hh.ru/vacancy/..."
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 text-[15px] outline-none"
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-[#1d1d1f]">
                Новый файл резюме (необязательно)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-[#6e6e73]"
              />
              <p className="mt-3 text-sm text-[#6e6e73]">
                Если файл не загружать, для анализа возьмём резюме из кабинета.
              </p>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-[#1d1d1f]">
                О себе / дополнительный контекст
              </label>
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                rows={6}
                placeholder="Здесь можно дописать важный контекст, который должен использоваться в отклике"
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#0071e3] px-6 py-3 text-sm font-medium text-white"
            >
              {loading ? "Анализируем..." : "Анализировать"}
            </button>

            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
          </form>
        </section>

        {result && (
          <section className="mt-8 space-y-6 md:mt-10">
            <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm text-[#6e6e73]">{result.vacancy.company}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                    {result.vacancy.title}
                  </h2>
                </div>

                <a
                  href={result.vacancy.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white"
                >
                  Перейти к отклику
                </a>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
                <p className="text-sm text-[#6e6e73]">Fit score</p>
                <div className="mt-3 text-5xl font-semibold tracking-tight">
                  {result.analysis.fit_score}
                </div>
                <div
                  className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-medium ring-1 ${matchMeta.chip}`}
                >
                  {matchMeta.label}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
                <h3 className="text-xl font-semibold tracking-tight">
                  Почему подходишь
                </h3>
                <ul className="mt-5 space-y-3">
                  {result.analysis.strengths.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-2xl bg-[#f5f5f7] px-4 py-4 text-[15px] leading-7 text-[#1d1d1f]"
                    >
                      ✔ {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
              <h3 className="text-xl font-semibold tracking-tight">
                Что может мешать
              </h3>
              <ul className="mt-5 space-y-3">
                {result.analysis.gaps.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-2xl bg-[#f5f5f7] px-4 py-4 text-[15px] leading-7 text-[#1d1d1f]"
                  >
                    ⚠ {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">
                      Сопроводительное письмо
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
                      Уже включает короткий summary в начале.
                    </p>
                  </div>

                  <button
                    onClick={() => copyText(result.analysis.cover_letter, "cover")}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#1d1d1f]"
                  >
                    {copiedCover ? "Скопировано" : "Скопировать письмо"}
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5 text-[15px] leading-7 text-[#1d1d1f]">
                  <div className="whitespace-pre-wrap">{result.analysis.cover_letter}</div>
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">
                      Summary для резюме
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
                      Верхний блок резюме под эту вакансию.
                    </p>
                  </div>

                  <button
                    onClick={() => copyText(result.analysis.tailored_summary, "summary")}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#1d1d1f]"
                  >
                    {copiedSummary ? "Скопировано" : "Скопировать summary"}
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5 text-[15px] leading-7 text-[#1d1d1f]">
                  {result.analysis.tailored_summary}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}