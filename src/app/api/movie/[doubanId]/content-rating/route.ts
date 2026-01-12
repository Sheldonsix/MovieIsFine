import { NextResponse } from "next/server";
import { getMovieByDoubanId } from "@/services/movieService";

/**
 * GET /api/movie/[doubanId]/content-rating
 * 获取电影的分级信息
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ doubanId: string }> }
) {
  const { doubanId } = await params;

  if (!doubanId) {
    return NextResponse.json(
      { error: "Missing doubanId parameter" },
      { status: 400 }
    );
  }

  const movie = await getMovieByDoubanId(doubanId);

  if (!movie) {
    return NextResponse.json(
      { error: "Movie not found" },
      { status: 404 }
    );
  }

  const contentRatingZh = movie.parentalGuide?.content_rating_zh || null;

  return NextResponse.json({
    doubanId,
    contentRatingZh,
  });
}
