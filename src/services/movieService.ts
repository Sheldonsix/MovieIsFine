import { getDatabase } from "@/lib/mongodb";
import { Movie } from "@/types/movie";
import { WithId, Document } from "mongodb";
import { v4 as uuidv4 } from "uuid";

/**
 * 将 MongoDB 文档转换为 Movie 类型
 */
function toMovie(doc: WithId<Document>): Movie {
  const { _id, createdAt, updatedAt, ...movie } = doc;
  return movie as Movie;
}

/**
 * 获取电影总数
 */
export async function getMovieCount(): Promise<number> {
  const db = await getDatabase();
  return db.collection("movies").countDocuments();
}

/**
 * 获取所有电影 ID（用于静态生成）
 */
export async function getAllMovieIds(): Promise<string[]> {
  const db = await getDatabase();
  const movies = await db
    .collection("movies")
    .find({}, { projection: { id: 1 } })
    .toArray();
  return movies.map((m) => m.id as string);
}

/**
 * 获取所有 IMDB ID（用于静态生成）
 */
export async function getAllImdbIds(): Promise<string[]> {
  const db = await getDatabase();
  const movies = await db
    .collection("movies")
    .find({ imdbId: { $exists: true, $ne: "" } }, { projection: { imdbId: 1 } })
    .toArray();
  return movies.map((m) => m.imdbId as string);
}

/**
 * 根据 ID 获取电影
 */
export async function getMovieById(id: string): Promise<Movie | null> {
  const db = await getDatabase();
  const doc = await db.collection("movies").findOne({ id });
  return doc ? toMovie(doc) : null;
}

/**
 * 根据 IMDB ID 获取电影
 */
export async function getMovieByImdbId(imdbId: string): Promise<Movie | null> {
  const db = await getDatabase();
  const doc = await db.collection("movies").findOne({ imdbId });
  return doc ? toMovie(doc) : null;
}

/**
 * 排序字段
 */
export type SortField = "rating" | "releaseDate" | "title";

/**
 * 排序方向
 */
export type SortOrder = "asc" | "desc";

/**
 * 排序配置
 */
export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * 解析排序字符串为排序配置
 * @param sortStr 排序字符串，如 "rating_desc"、"releaseDate_asc"、"title_asc"
 */
export function parseSortString(sortStr: string): SortConfig {
  const [field, order] = sortStr.split("_") as [SortField, SortOrder];

  // 验证字段有效性
  const validFields: SortField[] = ["rating", "releaseDate", "title"];
  const validOrders: SortOrder[] = ["asc", "desc"];

  return {
    field: validFields.includes(field) ? field : "rating",
    order: validOrders.includes(order) ? order : "desc",
  };
}

/**
 * 排序字段映射到数据库字段
 */
const SORT_FIELD_MAP: Record<SortField, string> = {
  rating: "doubanRating",
  releaseDate: "releaseDate",
  title: "title",
};

/**
 * 分页获取电影列表
 * @param page 页码
 * @param limit 每页数量
 * @param sortConfig 排序配置
 */
export async function getMovies(
  page: number,
  limit: number = 24,
  sortConfig: SortConfig = { field: "rating", order: "desc" }
): Promise<Movie[]> {
  const db = await getDatabase();
  const skip = (page - 1) * limit;

  // 根据排序配置选择排序字段和方向
  const sortField = SORT_FIELD_MAP[sortConfig.field];
  const sortDirection = sortConfig.order === "asc" ? 1 : -1;

  const docs = await db
    .collection("movies")
    .find({})
    .sort({ [sortField]: sortDirection })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs.map(toMovie);
}

/**
 * 搜索电影
 * 支持按标题、导演、演员搜索
 */
export async function searchMovies(
  query: string,
  limit: number = 10
): Promise<Movie[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const db = await getDatabase();
  const searchTerm = query.trim();

  // 使用正则表达式进行模糊搜索（支持中文）
  const regex = new RegExp(searchTerm, "i");

  const docs = await db
    .collection("movies")
    .find({
      $or: [
        { title: regex },
        { originalTitle: regex },
        { director: regex },
        { cast: regex },
      ],
    })
    .limit(limit)
    .toArray();

  return docs.map(toMovie);
}

/**
 * 按类型筛选电影
 */
export async function getMoviesByGenre(
  genre: string,
  page: number = 1,
  limit: number = 24
): Promise<Movie[]> {
  const db = await getDatabase();
  const skip = (page - 1) * limit;

  const docs = await db
    .collection("movies")
    .find({ genres: genre })
    .sort({ doubanRating: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs.map(toMovie);
}

/**
 * 检查电影是否已存在（通过 imdbId 或 doubanUrl）
 */
export async function checkMovieExists(
  imdbId?: string,
  doubanUrl?: string
): Promise<{ exists: boolean; movie?: Movie }> {
  const db = await getDatabase();

  // 优先通过 imdbId 检查
  if (imdbId) {
    const doc = await db.collection("movies").findOne({ imdbId });
    if (doc) {
      return { exists: true, movie: toMovie(doc) };
    }
  }

  // 通过 doubanUrl 检查
  if (doubanUrl) {
    const doc = await db.collection("movies").findOne({ doubanUrl });
    if (doc) {
      return { exists: true, movie: toMovie(doc) };
    }
  }

  return { exists: false };
}

/**
 * 创建电影记录所需的数据（不包含 id）
 */
export type CreateMovieInput = Omit<Movie, "id">;

/**
 * 创建新电影
 */
export async function createMovie(input: CreateMovieInput): Promise<Movie> {
  const db = await getDatabase();

  // 生成唯一 ID
  const movie: Movie = {
    id: uuidv4(),
    ...input,
  };

  // 添加时间戳，并移除空值字段（避免唯一索引冲突）
  const docToInsert: Record<string, unknown> = {
    ...movie,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 移除 undefined 或空字符串的 imdbId（避免唯一索引冲突）
  if (!docToInsert.imdbId) {
    delete docToInsert.imdbId;
  }

  await db.collection("movies").insertOne(docToInsert);

  return movie;
}

/**
 * 更新电影记录
 */
export async function updateMovie(
  id: string,
  updates: Partial<Movie>
): Promise<Movie | null> {
  const db = await getDatabase();

  const result = await db.collection("movies").findOneAndUpdate(
    { id },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return result ? toMovie(result) : null;
}
