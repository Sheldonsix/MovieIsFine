import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovieById, movies } from "@/data/movies";
import MovieTimeline from "@/components/MovieTimeline";

export async function generateStaticParams() {
  return movies.map((movie) => ({
    id: movie.id,
  }));
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movie = getMovieById(id);

  if (!movie) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            返回首页
          </Link>
        </div>
      </header>

      {/* Movie Detail */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className="relative w-64 md:w-80 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
              <Image
                src={movie.poster}
                alt={movie.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {movie.title}
            </h1>
            {movie.originalTitle && (
              <p className="text-xl text-gray-400 mb-4">
                {movie.originalTitle}
              </p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center bg-yellow-500 px-4 py-2 rounded-lg">
                <svg
                  className="w-6 h-6 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-2xl font-bold">{movie.doubanRating}</span>
              </div>
              {movie.ratingCount && (
                <span className="text-gray-400">
                  {(movie.ratingCount / 10000).toFixed(0)}万人评价
                </span>
              )}
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <InfoRow label="导演" value={movie.director} />
              <InfoRow label="编剧" value={movie.writers.join(" / ")} />
              <InfoRow label="主演" value={movie.cast.join(" / ")} />
              <InfoRow label="类型" value={movie.genres.join(" / ")} />
              <InfoRow label="语言" value={movie.language} />
              <InfoRow label="上映日期" value={movie.releaseDate} />
              <InfoRow label="片长" value={`${movie.duration} 分钟`} />
            </div>

            {/* Synopsis */}
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-3 flex items-center">
                <span className="w-1 h-6 bg-yellow-500 mr-3 rounded"></span>
                剧情简介
              </h2>
              <p className="text-gray-300 leading-relaxed">{movie.synopsis}</p>
            </div>
          </div>
        </div>

        {/* Movie Timeline */}
        {movie.plotPoints && movie.plotPoints.length > 0 && (
          <div className="mt-8">
            <MovieTimeline
              duration={movie.duration}
              plotPoints={movie.plotPoints}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-gray-500 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
