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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb / Navigation */}
      <nav className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
        <Link 
          href="/" 
          className="flex items-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </Link>
        <span className="mx-3 text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-gray-200 truncate">{movie.title}</span>
      </nav>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Backdrop / Gradient Header */}
        <div className="h-32 md:h-48 bg-gradient-to-r from-gray-900 to-gray-800 relative">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <div className="px-6 md:px-10 pb-10">
          <div className="flex flex-col md:flex-row gap-8 -mt-20 relative z-10">
            {/* Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-56 md:w-72 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl ring-4 ring-white dark:ring-gray-800">
                <Image
                  src={movie.poster}
                  alt={movie.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Header Info */}
            <div className="flex-1 pt-4 md:pt-20 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 mt-2.5">
                  {movie.title}
                </h1>
                {movie.originalTitle && (
                  <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">
                    {movie.originalTitle}
                  </p>
                )}
              </div>

              {/* Rating Badge */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                 <div className="flex items-center bg-yellow-400/10 dark:bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 px-3 py-1.5 rounded-lg border border-yellow-400/20">
                  <span className="text-2xl font-bold mr-1">{movie.doubanRating}</span>
                  <div className="flex flex-col items-start leading-none ml-1">
                    <span className="text-[10px] opacity-80 uppercase tracking-wider">Douban</span>
                    <span className="text-xs font-bold">Score</span>
                  </div>
                </div>
                {movie.ratingCount && (
                   <span className="text-sm text-gray-500 dark:text-gray-400">
                    {(movie.ratingCount / 10000).toFixed(1)}w 人参与评价
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid & Synopsis */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            {/* Left Column: Synopsis */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-4">
                  <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                  剧情简介
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-8 text-lg">
                  {movie.synopsis}
                </p>
              </div>

              {/* Timeline Component Injection */}
              {movie.plotPoints && movie.plotPoints.length > 0 && (
                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-6">
                    <span className="w-1.5 h-6 bg-purple-500 rounded-full mr-3"></span>
                    剧情时间轴
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6">
                    <MovieTimeline
                      duration={movie.duration}
                      plotPoints={movie.plotPoints}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Meta Info */}
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                  影片信息
                </h3>
                
                <InfoItem label="导演" value={movie.director} />
                <InfoItem label="编剧" value={movie.writers.join(" / ")} />
                <InfoItem label="主演" value={movie.cast.join(" / ")} />
                <InfoItem label="类型" value={movie.genres.join(" ")} />
                <InfoItem label="语言" value={movie.language} />
                <InfoItem label="上映" value={movie.releaseDate} />
                <InfoItem label="片长" value={`${movie.duration} 分钟`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="group">
      <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1 group-hover:text-indigo-500 transition-colors">{label}</span>
      <span className="block text-sm font-medium text-gray-900 dark:text-gray-200 leading-snug">{value}</span>
    </div>
  );
}
