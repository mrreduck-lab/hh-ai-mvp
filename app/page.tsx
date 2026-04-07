"use client";

import { useState } from "react";

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
  };
};

export default function HomePage() {
  const [vacancyUrl, setVacancyUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setCopied(false);

    if (!vacancyUrl.trim()) {
      setError("Добавь ссылку на вакансию hh.ru");
      return;
    }

    if (!resumeFile) {
      setError("Загрузи резюме");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("vacancyUrl", vacancyUrl.trim());
      formData.append("resumeFile", resumeFile);

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

  async function handleCopyCoverLetter() {
    if (!result?.analysis.cover_letter) return;
    await navigator.clipboard.writeText(result.analysis.cover_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const matchLabel = getMatchLabel(result?.analysis.match_level);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            HH AI MVP
          </h1>
          <p className="mt-2 text-neutral-600">
            Вставь ссылку на вакансию hh.ru, загрузи резюме и получи готовое
            сопроводительное письмо с оценкой fit.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <form onSubmit={handleAnalyze} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Ссылка на вакансию hh.ru
              </label>
              <input
                type="url"
                value={vacancyUrl}
                onChange={(e) => setVacancyUrl(e.target.value)}
                placeholder="https://hh.ru/vacancy/..."
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 outline-none transition focus:border-neutral-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Резюме (PDF, DOCX, TXT)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />
              {resumeFile && (
                <p className="mt-2 text-sm text-neutral-500">
                  Загружено: {resumeFile.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-neutral-900 px-5 py-3 text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Анализируем..." : "Анализировать"}
            </button>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
          </form>
        </section>

        {result && (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{result.vacancy.company}</p>
                  <h2 className="mt-1 text-2xl font-semibold">{result.vacancy.title}</h2>
                </div>

                <a
                  href={result.vacancy.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Перейти к отклику
                </a>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
                <p className="text-sm text-neutral-500">Fit score</p>
                <div className="mt-2 text-4xl font-bold">
                  {result.analysis.fit_score}
                </div>
                <div className="mt-2 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium">
                  {matchLabel}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 md:col-span-2">
                <h3 className="text-lg font-semibold">Почему подходишь</h3>
                <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                  {result.analysis.strengths.map((item, index) => (
                    <li key={index} className="rounded-lg bg-neutral-50 px-3 py-2">
                      ✔ {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
              <h3 className="text-lg font-semibold">Что может мешать</h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {result.analysis.gaps.map((item, index) => (
                  <li key={index} className="rounded-lg bg-neutral-50 px-3 py-2">
                    ⚠ {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Сопроводительное письмо</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Уже включает короткий summary в начале.
                  </p>
                </div>

                <button
                  onClick={handleCopyCoverLetter}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  {copied ? "Скопировано" : "Скопировать письмо"}
                </button>
              </div>

              <div className="mt-4 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-800">
                {result.analysis.cover_letter}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function getMatchLabel(level?: "strong" | "medium" | "low") {
  if (level === "strong") return "Strong match";
  if (level === "medium") return "Medium match";
  if (level === "low") return "Low match";
  return "";
}
