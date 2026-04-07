import * as cheerio from "cheerio";

export type ParsedVacancy = {
  title: string;
  company: string;
  description: string;
  url: string;
};

export async function parseVacancyFromUrl(url: string): Promise<ParsedVacancy> {
  validateVacancyUrl(url);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "ru,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Не удалось открыть вакансию. HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    clean(
      $("h1").first().text() ||
        $('[data-qa="vacancy-title"]').first().text() ||
        $("title").text()
    ) || "Без названия";

  const company =
    clean(
      $('[data-qa="vacancy-company-name"]').first().text() ||
        $('[data-qa="bloko-header-2"]').first().text()
    ) || "Компания не найдена";

  // Пытаемся вытащить основное описание
  const descriptionSelectors = [
    '[data-qa="vacancy-description"]',
    ".vacancy-description",
    ".g-user-content",
    "main",
  ];

  let description = "";

  for (const selector of descriptionSelectors) {
    const text = clean($(selector).first().text());
    if (text && text.length > description.length) {
      description = text;
    }
  }

  if (!description || description.length < 300) {
    description = clean($("body").text());
  }

  description = truncate(description, 12000);

  return {
    title,
    company,
    description,
    url,
  };
}

function validateVacancyUrl(url: string): void {
  try {
    const parsed = new URL(url);
    const allowedHosts = ["hh.ru", "spb.hh.ru", "ekaterinburg.hh.ru"];
    const isAllowed = allowedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      throw new Error();
    }
  } catch {
    throw new Error("Нужна корректная ссылка на вакансию hh.ru");
  }
}

function clean(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}
