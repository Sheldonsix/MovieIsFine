/**
 * 图片下载服务
 * 将远程图片下载到本地 public 目录
 */

import { promises as fs } from "fs";
import path from "path";

const POSTERS_DIR = path.join(process.cwd(), "public", "posters");

/**
 * 确保目录存在
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * 从 URL 提取文件扩展名
 */
function getExtension(url: string): string {
  const match = url.match(/\.(\w+)(?:\?|$)/);
  if (match) {
    const ext = match[1].toLowerCase();
    // 统一转换为常见格式
    if (ext === "webp") return "jpg";
    return ext;
  }
  return "jpg";
}

/**
 * 下载豆瓣海报图片到本地
 * @param imageUrl 豆瓣图片 URL
 * @param movieId 电影 ID（用于命名文件）
 * @returns 本地图片路径（相对于 public）
 */
export async function downloadPoster(
  imageUrl: string,
  movieId: string
): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    await ensureDir(POSTERS_DIR);

    const ext = getExtension(imageUrl);
    const filename = `${movieId}.${ext}`;
    const localPath = path.join(POSTERS_DIR, filename);
    const publicPath = `/posters/${filename}`;

    // 检查文件是否已存在
    try {
      await fs.access(localPath);
      // 文件已存在，直接返回
      return publicPath;
    } catch {
      // 文件不存在，继续下载
    }

    // 发送请求下载图片
    // 添加豆瓣的 Referer 头以绕过防盗链
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://movie.douban.com/",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.error(`Failed to download poster: ${response.status}`);
      return null;
    }

    // 获取图片数据
    const buffer = await response.arrayBuffer();

    // 保存到本地
    await fs.writeFile(localPath, Buffer.from(buffer));

    console.log(`Poster downloaded: ${publicPath}`);
    return publicPath;
  } catch (error) {
    console.error("Download poster error:", error);
    return null;
  }
}
