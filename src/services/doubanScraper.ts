/**
 * 豆瓣电影爬虫服务
 * 从豆瓣电影页面抓取电影信息
 *
 * 支持通过 Cookie 绕过反爬机制：
 * 1. 通过 ScrapeOptions.cookie 参数传入
 * 2. 通过环境变量 DOUBAN_COOKIE 设置（优先级较低）
 *
 * Cookie 获取方式：
 * 1. 在浏览器中登录豆瓣
 * 2. 打开开发者工具 (F12) -> Network
 * 3. 刷新页面，点击任意请求
 * 4. 复制 Request Headers 中的 Cookie 值
 */

import * as cheerio from "cheerio";

// User-Agent 列表，用于轮换
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

/**
 * 获取随机 User-Agent
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 豆瓣电影原始数据结构
 */
export interface DoubanMovieData {
  doubanId: string;
  doubanUrl: string;
  title: string;
  originalTitle?: string;
  poster: string;
  director: string;
  writers: string[];
  cast: string[];
  genres: string[];
  language: string;
  releaseDate: string;
  duration: number;
  synopsis: string;
  doubanRating: number;
  ratingCount?: number;
  imdbId?: string;
  isTVSeries?: boolean; // 是否为剧集
}

/**
 * 爬取结果
 */
export interface ScrapeResult {
  success: boolean;
  data?: DoubanMovieData;
  error?: string;
}

/**
 * 从豆瓣链接提取 subject ID
 */
export function extractDoubanId(url: string): string | null {
  const match = url.match(/subject\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * 解析片长字符串，返回分钟数
 * 例如: "142分钟" -> 142, "2小时22分钟" -> 142
 */
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;

  // 匹配 "XXX分钟" 格式
  const minuteMatch = durationStr.match(/(\d+)\s*分钟/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10);
  }

  // 匹配 "X小时XX分钟" 格式
  const hourMinuteMatch = durationStr.match(/(\d+)\s*小时\s*(\d+)?\s*分钟?/);
  if (hourMinuteMatch) {
    const hours = parseInt(hourMinuteMatch[1], 10);
    const minutes = hourMinuteMatch[2] ? parseInt(hourMinuteMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  return 0;
}

/**
 * 解析豆瓣 HTML 页面，提取电影信息
 */
function parseDoubanHtml(
  html: string,
  doubanId: string,
  normalizedUrl: string
): ScrapeResult {
  // 使用 cheerio 解析 HTML
  const $ = cheerio.load(html);

  // 提取 #info 区块的文本信息（后面多处使用）
  const infoText = $("#info").text() || "";

  // 检测是否为剧集
  // 剧集特征：包含"集数"或"单集片长"关键词
  const isTVSeries = /集数/.test(infoText) || /单集片长/.test(infoText);

  // 提取电影标题
  // 豆瓣标题格式: "中文名 原名" 或只有中文名
  const titleElement = $("span[property='v:itemreviewed']");
  const fullTitle = titleElement.text().trim();

  // 分离中文标题和原名
  let title = fullTitle;
  let originalTitle: string | undefined;

  // 从 #info 中提取原名（如果有的话）
  // 格式: "又名:</span> 原名1 / 又名2 / ..."
  const aliasMatch = infoText.match(/又名:\s*([^\n]+)/);
  const aliases = aliasMatch
    ? aliasMatch[1]
        .trim()
        .split(/\s*\/\s*/)
        .map((s) => s.trim())
        .filter((s) => s)
    : [];

  // 尝试从全标题中分离中文名和英文原名
  // 常见格式: "小鬼当家 Home Alone" 或 "霸王别姬"
  const titleParts = fullTitle.match(/^(.+?)\s+([A-Za-z].+)$/);
  if (titleParts) {
    // 有英文部分，分离中英文
    title = titleParts[1].trim();
    originalTitle = titleParts[2].trim();
  } else {
    // 没有英文部分，检查又名中是否有英文原名
    title = fullTitle;
    // 在又名中找英文名作为原名
    const englishAlias = aliases.find((a) => /^[A-Za-z]/.test(a));
    if (englishAlias) {
      originalTitle = englishAlias;
    }
  }

  // 豆瓣标题格式通常是 "中文名 原名" 或只有中文名
  const yearMatch = $("span.year").text().match(/\((\d+)\)/);
  const year = yearMatch ? yearMatch[1] : "";

  // 提取海报
  // 优先尝试从 mainpic 的链接获取大图
  const mainpicLink = $("#mainpic a");
  let poster = "";

  // 尝试获取大图链接（点击海报后的大图页面）
  const posterPageHref = mainpicLink.attr("href");
  if (posterPageHref && posterPageHref.includes("/photo/")) {
    // 从海报页面链接中提取图片 ID，构造大图 URL
    // 海报页面格式: https://movie.douban.com/subject/1291546/photos?type=R
    // 或者直接链接到某张图片
  }

  // 从 img 标签获取海报
  const posterImg = $("#mainpic img");
  const posterSrc = posterImg.attr("src") || "";

  if (posterSrc) {
    // 豆瓣海报 URL 格式说明：
    // - s_ratio_poster: 小图 (约 135x200)
    // - m_ratio_poster: 中图 (约 270x400)
    // - l_ratio_poster: 大图 (约 540x800) - 可能不存在
    // 使用中等尺寸的图片，更可靠
    poster = posterSrc
      .replace(/s_ratio_poster/g, "m_ratio_poster")
      .replace(/\.webp$/, ".jpg"); // 优先使用 jpg 格式
  }

  // 如果还是没有，使用原始 src
  if (!poster && posterSrc) {
    poster = posterSrc;
  }

  // 提取导演
  const directorElement = $('a[rel="v:directedBy"]');
  const director = directorElement
    .map((_, el) => $(el).text().trim())
    .get()
    .join(" / ");

  // 提取编剧
  // 豆瓣 #info 区块中编剧的格式: <span class="pl">编剧</span>: <a>编剧1</a> / <a>编剧2</a>
  const writers: string[] = [];
  // 找到编剧标签，然后获取后面的链接（直到遇到下一个 <br> 或 <span class="pl">）
  const writerLabel = $("#info span.pl")
    .filter((_, el) => $(el).text().includes("编剧"))
    .first();
  if (writerLabel.length > 0) {
    // 获取编剧标签后面的所有兄弟元素，直到遇到下一个 span.pl 或 br
    let nextEl = writerLabel.next();
    while (nextEl.length > 0 && !nextEl.is("span.pl") && !nextEl.is("br")) {
      if (nextEl.is("a")) {
        const name = nextEl.text().trim();
        if (name && !writers.includes(name)) {
          writers.push(name);
        }
      }
      nextEl = nextEl.next();
    }
  }
  // 如果没找到链接形式，尝试从文本解析
  if (writers.length === 0) {
    const writerMatch = infoText.match(/编剧:\s*([^\n]+)/);
    if (writerMatch) {
      const writerNames = writerMatch[1]
        .trim()
        .split(/\s*\/\s*/)
        .map((s) => s.trim())
        .filter((s) => s && s.length < 50)
        .slice(0, 10);
      writers.push(...writerNames);
    }
  }

  // 提取主演
  const castElements = $('a[rel="v:starring"]');
  const cast = castElements
    .map((_, el) => $(el).text().trim())
    .get()
    .slice(0, 10);

  // 提取类型
  const genreElements = $('span[property="v:genre"]');
  const genres = genreElements.map((_, el) => $(el).text().trim()).get();

  // 提取语言
  let language = "";
  const langMatch = infoText.match(/语言:\s*([^\n]+)/);
  if (langMatch) {
    language = langMatch[1].trim().split(/\s*\/\s*/)[0];
  }

  // 提取上映日期
  // 豆瓣可能有多个上映日期，格式如：2026(中国大陆) / 1980-05-23(美国点映) / 1980-06-13(美国)
  // 我们需要最早的原始上映日期（通常是最后一个）
  const releaseDateElements = $('span[property="v:initialReleaseDate"]')
    .map((_, el) => $(el).text().trim())
    .get();
  let releaseDate = "";
  if (releaseDateElements.length > 0) {
    // 解析所有日期，找出最早的
    const parsedDates: Array<{ date: Date; original: string }> = [];
    for (const dateStr of releaseDateElements) {
      // 提取日期部分（YYYY-MM-DD 或 YYYY）
      const fullDateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
      const yearOnlyMatch = dateStr.match(/^(\d{4})/);

      if (fullDateMatch) {
        parsedDates.push({
          date: new Date(fullDateMatch[1]),
          original: fullDateMatch[1],
        });
      } else if (yearOnlyMatch) {
        parsedDates.push({
          date: new Date(`${yearOnlyMatch[1]}-01-01`),
          original: yearOnlyMatch[1],
        });
      }
    }

    if (parsedDates.length > 0) {
      // 按日期升序排序，取最早的
      parsedDates.sort((a, b) => a.date.getTime() - b.date.getTime());
      releaseDate = parsedDates[0].original;
    }
  } else if (year) {
    releaseDate = year;
  }

  // 提取片长
  const durationElement = $('span[property="v:runtime"]').text();
  const duration = parseDuration(durationElement);

  // 提取剧情简介
  const synopsisElement = $('span[property="v:summary"]');
  let synopsis = synopsisElement.text().trim();
  // 清理多余空白
  synopsis = synopsis.replace(/\s+/g, " ").trim();

  // 提取豆瓣评分
  const ratingElement = $('strong[property="v:average"]');
  const doubanRating = parseFloat(ratingElement.text()) || 0;

  // 提取评分人数
  const ratingCountElement = $('span[property="v:votes"]');
  const ratingCount = parseInt(ratingCountElement.text()) || 0;

  // 提取 IMDb ID
  let imdbId: string | undefined;
  const imdbMatch = infoText.match(/IMDb:\s*(tt\d+)/i);
  if (imdbMatch) {
    imdbId = imdbMatch[1];
  } else {
    // 尝试从链接中查找
    const imdbLink = $('a[href*="imdb.com/title/tt"]').attr("href");
    if (imdbLink) {
      const idMatch = imdbLink.match(/tt\d+/);
      if (idMatch) {
        imdbId = idMatch[0];
      }
    }
  }

  const movieData: DoubanMovieData = {
    doubanId,
    doubanUrl: normalizedUrl,
    title,
    originalTitle,
    poster,
    director,
    writers,
    cast,
    genres,
    language,
    releaseDate,
    duration,
    synopsis,
    doubanRating,
    ratingCount,
    imdbId,
    isTVSeries,
  };

  return {
    success: true,
    data: movieData,
  };
}

/**
 * 抓取选项
 */
export interface ScrapeOptions {
  /** 豆瓣 Cookie，用于绕过反爬（优先级高于环境变量） */
  cookie?: string;
  /** 请求超时时间（毫秒），默认 10000 */
  timeout?: number;
  /** 重试次数，默认 2 */
  retries?: number;
  /** 重试间隔（毫秒），默认 1000 */
  retryDelay?: number;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取 Cookie（优先使用参数，其次使用环境变量）
 */
function getCookie(options?: ScrapeOptions): string | undefined {
  return options?.cookie || process.env.DOUBAN_COOKIE;
}

/**
 * 从豆瓣页面抓取电影信息
 * @param doubanUrl 豆瓣电影链接
 * @param options 抓取选项（可选）
 */
export async function scrapeDoubanMovie(
  doubanUrl: string,
  options?: ScrapeOptions
): Promise<ScrapeResult> {
  const doubanId = extractDoubanId(doubanUrl);
  if (!doubanId) {
    return {
      success: false,
      error: "无效的豆瓣链接格式",
    };
  }

  const normalizedUrl = `https://movie.douban.com/subject/${doubanId}/`;
  const timeout = options?.timeout ?? 10000;
  const retries = options?.retries ?? 2;
  const retryDelay = options?.retryDelay ?? 1000;
  const cookie = getCookie(options);

  let lastError: string = "未知错误";

  // 重试循环
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`  ⏳ 重试 ${attempt}/${retries}...`);
      await delay(retryDelay * attempt); // 递增延迟
    }

    // 构建请求头（每次请求使用随机 User-Agent）
    const headers: Record<string, string> = {
      "User-Agent": getRandomUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Referer: "https://movie.douban.com/",
    };

    // 如果提供了 Cookie，添加到请求头
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 发送请求获取页面内容
      // 使用 redirect: 'manual' 手动处理重定向，以便检测反爬重定向
      const response = await fetch(normalizedUrl, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 检查是否被重定向到反爬验证页面
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get("location") || "";
        if (location.includes("sec.douban.com")) {
          lastError = "触发豆瓣反爬验证（Proof of Work），请提供有效 Cookie 或更换 IP";
          continue; // 重试
        }
        // 其他重定向，尝试跟随
        const redirectController = new AbortController();
        const redirectTimeoutId = setTimeout(
          () => redirectController.abort(),
          timeout
        );

        const redirectResponse = await fetch(location, {
          headers,
          signal: redirectController.signal,
        });

        clearTimeout(redirectTimeoutId);

        if (!redirectResponse.ok) {
          lastError = `重定向后请求失败: ${redirectResponse.status}`;
          continue;
        }
        const html = await redirectResponse.text();
        return parseDoubanHtml(html, doubanId, normalizedUrl);
      }

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: "电影不存在",
          };
        }
        if (response.status === 403) {
          lastError = "访问被拒绝，可能触发了反爬机制";
          continue; // 重试
        }
        if (response.status === 429) {
          lastError = "请求过于频繁，请稍后重试";
          continue; // 重试
        }
        lastError = `请求失败: ${response.status}`;
        continue;
      }

      const html = await response.text();

      // 检查是否需要登录或验证码（备用检测）
      if (
        html.includes("sec.douban.com") ||
        html.includes("验证码") ||
        html.includes("载入中 ...")
      ) {
        lastError = "需要验证码验证，请提供有效 Cookie";
        continue; // 重试
      }

      return parseDoubanHtml(html, doubanId, normalizedUrl);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = `请求超时 (${timeout}ms)`;
        } else {
          lastError = error.message;
        }
      } else {
        lastError = String(error);
      }
      // 继续重试
    }
  }

  // 所有重试都失败
  console.error(`Scrape failed after ${retries + 1} attempts:`, lastError);
  return {
    success: false,
    error: lastError,
  };
}
