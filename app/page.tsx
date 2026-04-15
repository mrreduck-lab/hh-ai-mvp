"use client";

import { useMemo, useState } from "react";

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

export default function HomePage() {
  const [vacancyUrl, setVacancyUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const [copiedCover, setCopiedCover] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

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
              Улучши отклик под вакансию
            </h1>
            <p className="mt-4 text-base leading-7 text-[#6e6e73] md:text-lg">
              Вставь ссылку на вакансию hh.ru, загрузи резюме и получи готовое
              сопроводительное письмо, summary для резюме и сильные правки “до / после”.
            </p>
          </div>
        </section>

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
                className="w-full rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-4 text-[15px] outline-none transition placeholder:text-[#8e8e93] focus:border-black/20 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-[#1d1d1f]">
                Резюме (PDF, DOCX, TXT)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-[#6e6e73]"
              />
              {resumeFile && (
                <p className="mt-3 text-sm text-[#6e6e73]">
                  Загружено: {resumeFile.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-[#0071e3] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Анализируем..." : "Анализировать"}
              </button>
              <p className="text-sm text-[#6e6e73]">
                Сначала оцениваем fit, потом собираем письмо и правки резюме.
              </p>
            </div>

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
                  className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition hover:bg-black"
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
                    className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
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
                    onClick={() =>
                      copyText(result.analysis.tailored_summary, "summary")
                    }
                    className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
                  >
                    {copiedSummary ? "Скопировано" : "Скопировать summary"}
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-[#f5f5f7] p-5 text-[15px] leading-7 text-[#1d1d1f]">
                  {result.analysis.tailored_summary}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
              <h3 className="text-xl font-semibold tracking-tight">
                Что усилить в резюме под вакансию
              </h3>
              <div className="mt-5 flex flex-wrap gap-3">
                {result.analysis.resume_highlights.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-full bg-[#f5f5f7] px-4 py-2 text-sm text-[#1d1d1f] ring-1 ring-black/5"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5 md:p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">
                  Резюме: было → стало
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6e6e73]">
                  Ниже — готовые формулировки, которые можно перенести в резюме на HH.
                </p>
              </div>

              <div className="space-y-5">
                {result.analysis.resume_rewrites.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-3xl bg-[#fbfbfd] p-5 ring-1 ring-black/5"
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-[#f2f2f7] p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">
                          Было
                        </p>
                        <p className="text-[15px] leading-7 text-[#1d1d1f]">
                          {item.original}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#eef6ff] p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0071e3]">
                          Стало
                        </p>
                        <p className="text-[15px] leading-7 text-[#1d1d1f]">
                          {item.rewritten}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}