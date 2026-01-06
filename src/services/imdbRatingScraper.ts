/**
 * IMDb 评分爬虫服务
 * 从 IMDb 电影页面抓取评分和评价人数信息
 *
 * 使用 JSON-LD 结构化数据提取，可靠性高
 */

/**
 * IMDb 评分信息
 */
export interface IMDBRating {
  imdbId: string;
  title: string;
  url: string;
  rating: number | null;
  ratingCount: number | null;
  bestRating: number;
  worstRating: number;
}

/**
 * 爬取结果
 */
export interface IMDBRatingResult {
  success: boolean;
  data?: IMDBRating;
  error?: string;
}

/**
 * JSON-LD 结构化数据中的评分信息
 */
interface JsonLdAggregateRating {
  "@type": string;
  ratingCount: number;
  bestRating: number;
  worstRating: number;
  ratingValue: number;
}

/**
 * JSON-LD 结构化数据
 */
interface JsonLdData {
  "@context": string;
  "@type": string;
  name?: string;
  aggregateRating?: JsonLdAggregateRating;
}

/**
 * HTTP 请求头（模拟浏览器）
 */
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

/**
 * 从 HTML 中提取 JSON-LD 结构化数据
 */
function extractJsonLd(html: string): JsonLdData | null {
  const match = html.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s
  );
  if (match) {
    try {
      return JSON.parse(match[1]) as JsonLdData;
    } catch (e) {
      console.error("Failed to parse JSON-LD:", e);
    }
  }
  return null;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 从 IMDb 抓取电影评分信息
 * @param imdbId IMDb ID (例如 "tt0111161")
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试延迟（毫秒）
 */
export async function scrapeImdbRating(
  imdbId: string,
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<IMDBRatingResult> {
  // 标准化 IMDb ID
  if (!imdbId.startsWith("tt")) {
    imdbId = `tt${imdbId}`;
  }

  const url = `https://www.imdb.com/title/${imdbId}/`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: "电影不存在",
          };
        }
        if (response.status === 403) {
          console.warn(
            `Access forbidden (403). Attempt ${attempt}/${maxRetries}`
          );
          if (attempt < maxRetries) {
            await delay(retryDelay * attempt);
            continue;
          }
          return {
            success: false,
            error: "访问被拒绝，可能触发了反爬机制",
          };
        }
        if (response.status === 429) {
          console.warn(`Rate limited (429). Waiting longer...`);
          if (attempt < maxRetries) {
            await delay(retryDelay * (attempt + 2));
            continue;
          }
          return {
            success: false,
            error: "请求频率过高，请稍后重试",
          };
        }

        if (attempt < maxRetries) {
          await delay(retryDelay * attempt);
          continue;
        }
        return {
          success: false,
          error: `请求失败: ${response.status}`,
        };
      }

      const html = await response.text();
      const jsonLd = extractJsonLd(html);

      if (!jsonLd) {
        return {
          success: false,
          error: "无法从页面提取评分数据",
        };
      }

      const aggregateRating = jsonLd.aggregateRating;

      const rating: IMDBRating = {
        imdbId,
        url,
        title: jsonLd.name || "",
        rating: aggregateRating?.ratingValue ?? null,
        ratingCount: aggregateRating?.ratingCount ?? null,
        bestRating: aggregateRating?.bestRating ?? 10,
        worstRating: aggregateRating?.worstRating ?? 1,
      };

      return {
        success: true,
        data: rating,
      };
    } catch (error) {
      console.error(`IMDb rating scrape error (attempt ${attempt}):`, error);

      if (attempt < maxRetries) {
        await delay(retryDelay * attempt);
        continue;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  return {
    success: false,
    error: "请求失败，已达最大重试次数",
  };
}

/**
 * 从 URL 抓取评分信息
 * @param url 完整的 IMDb URL
 */
export async function scrapeImdbRatingFromUrl(
  url: string
): Promise<IMDBRatingResult> {
  const match = url.match(/\/title\/(tt\d+)\//);
  if (!match) {
    return {
      success: false,
      error: "无效的 IMDb URL",
    };
  }

  return scrapeImdbRating(match[1]);
}

/**
 * 批量抓取评分信息
 * @param imdbIds IMDb ID 列表
 * @param delayMs 请求间隔（毫秒）
 */
export async function scrapeImdbRatingsBatch(
  imdbIds: string[],
  delayMs: number = 1000
): Promise<IMDBRatingResult[]> {
  const results: IMDBRatingResult[] = [];

  for (let i = 0; i < imdbIds.length; i++) {
    const result = await scrapeImdbRating(imdbIds[i]);
    results.push(result);

    // 请求间隔（最后一个不需要等待）
    if (i < imdbIds.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}
