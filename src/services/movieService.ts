import { getDatabase } from "@/lib/mongodb";
import { Movie } from "@/types/movie";
import { WithId, Document } from "mongodb";

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
 * 分页获取电影列表
 */
export async function getMovies(
  page: number,
  limit: number = 24
): Promise<Movie[]> {
  const db = await getDatabase();
  const skip = (page - 1) * limit;

  const docs = await db
    .collection("movies")
    .find({})
    .sort({ doubanRating: -1 })
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
