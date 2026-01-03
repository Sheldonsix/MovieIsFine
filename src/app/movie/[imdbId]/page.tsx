import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovieByImdbId, getAllImdbIds } from "@/services/movieService";
import MovieTimeline from "@/components/MovieTimeline";
import ParentalGuide from "@/components/ParentalGuide";

export async function generateStaticParams() {
  const imdbIds = await getAllImdbIds();
  return imdbIds.map((imdbId) => ({ imdbId }));
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ imdbId: string }>;
}) {
  const { imdbId } = await params;
  const movie = await getMovieByImdbId(imdbId);

  if (!movie) {
    notFound();
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Breadcrumb / Navigation */}
      <nav className="flex items-center justify-between text-sm font-medium text-gray-500 dark:text-gray-400 px-2">
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
          >
            <svg className="w-5 h-5 mr-1.5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
          <span className="mx-3 text-gray-300 dark:text-gray-600">/</span>
          <span className="text-gray-900 dark:text-gray-200 truncate max-w-[200px] md:max-w-none font-semibold">{movie.title}</span>
        </div>
      </nav>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transition-all duration-300">
        {/* Backdrop / Image Blur Header */}
        <div className="h-48 md:h-72 relative overflow-hidden group">
          <div className="absolute inset-0 z-0 scale-110 blur-2xl opacity-40 dark:opacity-30">
            <Image
              src={movie.poster}
              alt=""
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/40 via-gray-900/60 to-white dark:to-gray-900 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 z-10"></div>
        </div>

        <div className="px-6 md:px-12 pb-12">
          <div className="flex flex-col md:flex-row gap-10 -mt-32 md:-mt-40 relative z-20">
            {/* Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-64 md:w-80 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-8 ring-white dark:ring-gray-900 transition-transform hover:scale-[1.02] duration-500">
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
            <div className="flex-1 pt-4 md:pt-44 text-center md:text-left space-y-6">
              <div>
                <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-tight">
                  {movie.title}
                </h1>
                {movie.originalTitle && (
                  <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 font-light tracking-wide italic">
                    {movie.originalTitle}
                  </p>
                )}
              </div>

              {/* Rating Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                {/* Douban Card */}
                <div className="flex items-center bg-green-50 dark:bg-green-900/20 rounded-2xl p-1 pr-4 border border-green-100 dark:border-green-800/30 group hover:bg-green-100 transition-colors">
                  <div className="bg-green-500 text-white rounded-xl px-3 py-2 mr-3 font-bold text-sm">豆瓣</div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold text-green-700 dark:text-green-400 leading-none">{movie.doubanRating}</span>
                      <span className="text-xs text-green-600/60 dark:text-green-500/60 ml-0.5 font-medium">/10</span>
                    </div>
                    {movie.ratingCount && (
                      <span className="text-[10px] text-green-600/70 dark:text-green-500/70 font-semibold uppercase tracking-tighter">
                        {(movie.ratingCount / 10000).toFixed(1)}W 评价
                      </span>
                    )}
                  </div>
                </div>

                {/* IMDb Card */}
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-1 pr-4 border border-yellow-100 dark:border-yellow-800/30 group hover:bg-yellow-100 transition-colors"
                  >
                    <div className="bg-yellow-400 text-black rounded-xl px-3 py-2 mr-3 font-black text-sm uppercase tracking-tight">IMDb</div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500 leading-tight">查看资料</span>
                      <span className="text-[10px] text-yellow-600/70 dark:text-yellow-500/70 font-mono">{movie.imdbId}</span>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid & Synopsis */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12">

            {/* Left Column: Synopsis & Content */}
            <div className="lg:col-span-8 space-y-12">
              <section>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mb-6">
                  <span className="w-2 h-8 bg-indigo-500 rounded-full mr-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></span>
                  剧情简介
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-[2.2] text-xl font-light">
                  {movie.synopsis}
                </p>
              </section>

              {/* Timeline Component */}
              {movie.plotPoints && movie.plotPoints.length > 0 && (
                <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
                   <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mb-8">
                    <span className="w-2 h-8 bg-purple-500 rounded-full mr-4 shadow-[0_0_15px_rgba(168,85,247,0.5)]"></span>
                    剧情时间轴
                  </h3>
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-800">
                    <MovieTimeline
                      duration={movie.duration}
                      plotPoints={movie.plotPoints}
                    />
                  </div>
                </section>
              )}

              {/* Parental Guide Section */}
              {movie.parentalGuide && (
                <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mb-8">
                    <span className="w-2 h-8 bg-amber-500 rounded-full mr-4 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></span>
                    家长指南
                  </h3>
                  <ParentalGuide guide={movie.parentalGuide} />
                </section>
              )}
            </div>

            {/* Right Column: Meta Info */}
            <div className="lg:col-span-4">
              <div className="bg-gray-50/80 dark:bg-gray-800/40 backdrop-blur-sm rounded-[2rem] p-8 space-y-8 sticky top-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
                  影片详细信息
                </h3>

                <div className="space-y-6">
                  <InfoItem label="导演" value={movie.director} icon="🎬" />
                  <InfoItem label="编剧" value={movie.writers.join(" / ")} icon="✍️" />
                  <InfoItem label="主演" value={movie.cast.join(" / ")} icon="🎭" />
                  <InfoItem label="类型" value={movie.genres.join(" · ")} icon="📽️" />
                  <InfoItem label="语言" value={movie.language} icon="🌐" />
                  <InfoItem label="上映日期" value={movie.releaseDate} icon="📅" />
                  <InfoItem label="片长" value={`${movie.duration} 分钟`} icon="⏱️" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="group transition-all duration-300">
      <div className="flex items-center text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">
        <span className="mr-2 opacity-70 group-hover:opacity-100">{icon}</span>
        {label}
      </div>
      <span className="block text-base font-semibold text-gray-800 dark:text-gray-200 leading-relaxed pl-6">
        {value}
      </span>
    </div>
  );
}
