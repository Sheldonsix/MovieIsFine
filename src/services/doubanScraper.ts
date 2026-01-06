/**
 * 豆瓣电影爬虫服务
 * 从豆瓣电影页面抓取电影信息
 */

import * as cheerio from "cheerio";

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
 * 从豆瓣页面抓取电影信息
 */
export async function scrapeDoubanMovie(
  doubanUrl: string
): Promise<ScrapeResult> {
  const doubanId = extractDoubanId(doubanUrl);
  if (!doubanId) {
    return {
      success: false,
      error: "无效的豆瓣链接格式",
    };
  }

  const normalizedUrl = `https://movie.douban.com/subject/${doubanId}/`;

  try {
    // 发送请求获取页面内容
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Referer: "https://movie.douban.com/",
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

    // 检查是否需要登录或验证码
    if (html.includes("sec.douban.com") || html.includes("验证码")) {
      return {
        success: false,
        error: "需要验证码验证，请稍后重试",
      };
    }

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
    const releaseDateElement = $('span[property="v:initialReleaseDate"]')
      .first()
      .text();
    let releaseDate = "";
    if (releaseDateElement) {
      // 提取日期部分，去掉地区信息
      const dateMatch = releaseDateElement.match(/(\d{4}-\d{2}-\d{2})/);
      releaseDate = dateMatch ? dateMatch[1] : releaseDateElement.split("(")[0];
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
  } catch (error) {
    console.error("Scrape error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
