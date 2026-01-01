/**
 * IMDb 家长指南爬虫服务
 * 从 IMDb Parental Guide 页面抓取家长指南信息
 */

import type {
  ParentalGuide,
  GuideCategory,
  Certification,
  CertificationRating,
  GuideCategoryKey,
} from "@/types/parentalGuide";
import {
  translateTexts,
  translateContentRating,
} from "@/services/translationService";

/**
 * 爬取结果
 */
export interface ParentalGuideResult {
  success: boolean;
  data?: ParentalGuide;
  error?: string;
}

/**
 * 类别 section ID 映射
 */
const CATEGORY_SECTION_IDS: Record<string, string> = {
  sex_nudity: "nudity",
  violence_gore: "violence",
  profanity: "profanity",
  alcohol_drugs_smoking: "alcohol",
  frightening_intense: "frightening",
};

/**
 * 严重程度标准化映射
 */
const SEVERITY_MAP: Record<string, "None" | "Mild" | "Moderate" | "Severe"> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

/**
 * 清理文本，去除多余空白
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 标准化严重程度值
 */
function normalizeSeverity(
  severity: string
): "None" | "Mild" | "Moderate" | "Severe" {
  const normalized = severity.toLowerCase().trim();
  return SEVERITY_MAP[normalized] || "None";
}

/**
 * 从页面内容中查找特定 section 的内容
 */
function findSectionContent(html: string, sectionId: string): string {
  // 使用正则表达式找到 section 内容
  // 从 id="sectionId" 开始，到下一个 section 或页面结束
  const pattern = new RegExp(
    `id="${sectionId}".*?(?=id="(?:nudity|violence|profanity|alcohol|frightening|certificates)"|$)`,
    "s"
  );
  const match = html.match(pattern);
  return match ? match[0] : "";
}

/**
 * 提取类别的严重程度
 */
function extractCategorySeverity(
  sectionContent: string
): "None" | "Mild" | "Moderate" | "Severe" {
  // 在 section 内容中查找 signpost 文本
  const signpostMatch = sectionContent.match(
    /ipc-signpost__text[^>]*>([^<]+)/
  );
  if (signpostMatch) {
    return normalizeSeverity(cleanText(signpostMatch[1]));
  }
  return "None";
}

/**
 * 提取类别的详细条目
 */
function extractCategoryItems(sectionContent: string): string[] {
  const items: string[] = [];

  // 匹配 data-testid="item-html" 后面的内容
  const pattern =
    /data-testid="item-html".*?ipc-html-content-inner-div[^>]*>([^<]+)/gs;
  let match;

  while ((match = pattern.exec(sectionContent)) !== null) {
    const text = cleanText(match[1]);
    if (text && text.length > 0) {
      items.push(text);
    }
  }

  return items;
}

/**
 * 提取单个类别的完整信息
 */
function extractCategory(
  html: string,
  sectionId: string
): GuideCategory {
  const sectionContent = findSectionContent(html, sectionId);

  return {
    severity: extractCategorySeverity(sectionContent),
    items: extractCategoryItems(sectionContent),
    items_zh: [], // 暂时为空，后续可添加翻译
  };
}

/**
 * 提取内容分级（MPA rating）
 */
function extractContentRating(html: string): string {
  // 查找 content-rating section
  const pattern =
    /data-testid="content-rating".*?Motion Picture Rating.*?ipc-html-content-inner-div[^>]*>([^<]+)/s;
  const match = html.match(pattern);
  if (match) {
    return cleanText(match[1]);
  }
  return "";
}

/**
 * 提取电影标题
 */
function extractTitle(html: string): string {
  // 尝试从 subtitle 获取
  const subtitleMatch = html.match(/data-testid="subtitle"[^>]*>([^<]+)/);
  if (subtitleMatch) {
    return cleanText(subtitleMatch[1]);
  }

  // 回退：从 title 标签获取
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    const titleText = titleMatch[1];
    const nameMatch = titleText.match(/^(.+?)\s*\(\d{4}\)/);
    if (nameMatch) {
      return cleanText(nameMatch[1]);
    }
  }

  return "";
}

/**
 * 提取各国分级认证
 */
function extractCertifications(html: string): Certification[] {
  const certifications: Certification[] = [];

  // 查找 certificates 容器
  const certSectionMatch = html.match(
    /data-testid="certificates-container"(.*?)(?:<\/section>|<footer)/s
  );
  if (!certSectionMatch) {
    return certifications;
  }

  const certSection = certSectionMatch[0];

  // 按 certificates-item 分割，获取每个国家的块
  const countryBlocks = certSection.split(/(?=data-testid="certificates-item")/);

  for (const block of countryBlocks) {
    if (!block.includes("certificates-item")) {
      continue;
    }

    // 提取国家名称
    const countryMatch = block.match(
      /ipc-metadata-list-item__label[^>]*>([^<]+)/
    );
    const country = countryMatch ? cleanText(countryMatch[1]) : "";

    if (!country) {
      continue;
    }

    // 提取该国家的所有评级
    const ratings: CertificationRating[] = [];
    const ratingPattern =
      /ipc-metadata-list-item__list-content-item--link[^>]*>([^<]+)<\/a>(?:<span class="ipc-metadata-list-item__list-content-item--subText">([^<]*)<\/span>)?/gs;

    let ratingMatch;
    while ((ratingMatch = ratingPattern.exec(block)) !== null) {
      const rating = cleanText(ratingMatch[1]);
      const note = ratingMatch[2] ? cleanText(ratingMatch[2]) : "";

      if (rating) {
        ratings.push({ rating, note });
      }
    }

    if (ratings.length > 0) {
      certifications.push({ country, ratings });
    }
  }

  return certifications;
}

/**
 * 从 IMDb 抓取家长指南信息
 * @param imdbId IMDb ID (例如 "tt0111161")
 */
export async function scrapeImdbParentalGuide(
  imdbId: string
): Promise<ParentalGuideResult> {
  // 标准化 IMDb ID
  if (!imdbId.startsWith("tt")) {
    imdbId = `tt${imdbId}`;
  }

  const url = `https://www.imdb.com/title/${imdbId}/parentalguide/`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "电影不存在",
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: "访问被拒绝，可能触发了反爬机制",
        };
      }
      return {
        success: false,
        error: `请求失败: ${response.status}`,
      };
    }

    const html = await response.text();

    // 构建家长指南数据
    const parentalGuide: ParentalGuide = {
      imdb_id: imdbId,
      title: extractTitle(html),
      url: url,
      content_rating: extractContentRating(html),
      content_rating_zh: "", // 暂时为空
      sex_nudity: extractCategory(html, CATEGORY_SECTION_IDS.sex_nudity),
      violence_gore: extractCategory(html, CATEGORY_SECTION_IDS.violence_gore),
      profanity: extractCategory(html, CATEGORY_SECTION_IDS.profanity),
      alcohol_drugs_smoking: extractCategory(
        html,
        CATEGORY_SECTION_IDS.alcohol_drugs_smoking
      ),
      frightening_intense: extractCategory(
        html,
        CATEGORY_SECTION_IDS.frightening_intense
      ),
      certifications: extractCertifications(html),
    };

    return {
      success: true,
      data: parentalGuide,
    };
  } catch (error) {
    console.error("IMDb parental guide scrape error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 翻译家长指南中的所有文本内容
 */
export async function translateParentalGuide(
  guide: ParentalGuide
): Promise<ParentalGuide> {
  console.log(`Translating parental guide for ${guide.imdb_id}...`);

  // 翻译内容分级
  const contentRatingZh = await translateContentRating(guide.content_rating);

  // 收集所有需要翻译的条目
  const categoryKeys: GuideCategoryKey[] = [
    "sex_nudity",
    "violence_gore",
    "profanity",
    "alcohol_drugs_smoking",
    "frightening_intense",
  ];

  // 并行翻译所有类别
  const translatedCategories = await Promise.all(
    categoryKeys.map(async (key) => {
      const category = guide[key];
      if (!category.items || category.items.length === 0) {
        return { key, items_zh: [] };
      }
      const translatedItems = await translateTexts(category.items);
      return { key, items_zh: translatedItems };
    })
  );

  // 构建翻译后的指南
  const translatedGuide: ParentalGuide = {
    ...guide,
    content_rating_zh: contentRatingZh,
  };

  // 更新各类别的中文翻译
  for (const { key, items_zh } of translatedCategories) {
    translatedGuide[key] = {
      ...guide[key],
      items_zh,
    };
  }

  console.log(`Translation completed for ${guide.imdb_id}`);
  return translatedGuide;
}

/**
 * 从 IMDb 抓取家长指南信息并翻译
 * @param imdbId IMDb ID (例如 "tt0111161")
 * @param translate 是否翻译内容（默认 true）
 */
export async function scrapeAndTranslateParentalGuide(
  imdbId: string,
  translate: boolean = true
): Promise<ParentalGuideResult> {
  const result = await scrapeImdbParentalGuide(imdbId);

  if (!result.success || !result.data) {
    return result;
  }

  if (!translate) {
    return result;
  }

  try {
    const translatedGuide = await translateParentalGuide(result.data);
    return {
      success: true,
      data: translatedGuide,
    };
  } catch (error) {
    console.error("Translation error:", error);
    // 翻译失败时返回未翻译的数据
    return result;
  }
}
