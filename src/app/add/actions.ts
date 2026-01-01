"use server";

import { scrapeDoubanMovie, DoubanMovieData } from "@/services/doubanScraper";
import {
  checkMovieExists,
  createMovie,
  CreateMovieInput,
} from "@/services/movieService";
import { downloadPoster } from "@/services/imageDownloader";
import { Movie } from "@/types/movie";
import { v4 as uuidv4 } from "uuid";

/**
 * 添加电影的结果类型
 */
export interface AddMovieResult {
  success: boolean;
  message: string;
  movie?: Movie;
  error?: string;
}

/**
 * 将豆瓣爬取数据转换为电影创建数据
 */
async function doubanDataToMovieInput(
  data: DoubanMovieData
): Promise<CreateMovieInput> {
  // 生成一个临时 ID 用于下载海报命名
  const tempId = uuidv4();

  // 下载海报到本地
  let poster = data.poster;
  if (data.poster) {
    const localPoster = await downloadPoster(data.poster, tempId);
    if (localPoster) {
      poster = localPoster;
    }
  }

  return {
    imdbId: data.imdbId,
    doubanUrl: data.doubanUrl,
    title: data.title,
    originalTitle: data.originalTitle,
    poster,
    director: data.director,
    writers: data.writers,
    cast: data.cast,
    genres: data.genres,
    language: data.language,
    releaseDate: data.releaseDate,
    duration: data.duration,
    synopsis: data.synopsis,
    doubanRating: data.doubanRating,
    ratingCount: data.ratingCount,
  };
}

/**
 * Server Action: 添加电影
 * 1. 校验豆瓣链接
 * 2. 爬取豆瓣电影信息
 * 3. 检查是否已存在
 * 4. 保存到数据库
 */
export async function addMovie(doubanUrl: string): Promise<AddMovieResult> {
  // 1. 校验链接格式
  const doubanPattern = /^https?:\/\/movie\.douban\.com\/subject\/\d+\/?$/;
  if (!doubanPattern.test(doubanUrl.trim())) {
    return {
      success: false,
      message: "链接格式无效",
      error: "请输入有效的豆瓣电影链接",
    };
  }

  try {
    // 2. 爬取豆瓣电影信息
    const scrapeResult = await scrapeDoubanMovie(doubanUrl);

    if (!scrapeResult.success || !scrapeResult.data) {
      return {
        success: false,
        message: "获取电影信息失败",
        error: scrapeResult.error || "无法从豆瓣获取电影信息",
      };
    }

    const movieData = scrapeResult.data;

    // 3. 检查电影是否已存在
    const existsResult = await checkMovieExists(
      movieData.imdbId,
      movieData.doubanUrl
    );

    if (existsResult.exists) {
      return {
        success: false,
        message: "电影已存在",
        movie: existsResult.movie,
        error: `《${existsResult.movie?.title}》已在数据库中`,
      };
    }

    // 4. 创建电影记录（包括下载海报）
    const movieInput = await doubanDataToMovieInput(movieData);
    const movie = await createMovie(movieInput);

    return {
      success: true,
      message: "添加成功",
      movie,
    };
  } catch (error) {
    console.error("Add movie error:", error);
    return {
      success: false,
      message: "添加失败",
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
