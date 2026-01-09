import Link from "next/link";
import { Plus } from "lucide-react";
import MovieInfiniteList from "@/components/MovieInfiniteList";
import { fetchMovies, fetchMovieCount } from "@/app/actions";
import { parseSortString, type SortConfig } from "@/services/movieService";
import { MovieSearch } from "@/components/MovieSearch";

interface HomeProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // Parse sort parameter, default to rating descending
  const sortConfig: SortConfig = params.sort
    ? parseSortString(params.sort)
    : { field: "rating", order: "desc" };

  // Initial load of the first page with sort parameter
  const initialMovies = await fetchMovies(1, sortConfig);
  const movieCount = await fetchMovieCount();

  return (
    <div className="space-y-4">
      {/* Hero Section - Windows 95 Window Style */}
      <section className="window-90s">
        {/* Title bar */}
        <div className="win95-titlebar flex items-center justify-between">
          <span className="text-sm sm:text-base">🎬 MovieIsFine - Welcome!</span>
          <div className="flex gap-1">
            <button className="btn-90s px-2 py-0 text-xs">_</button>
            <button className="btn-90s px-2 py-0 text-xs">□</button>
            <button className="btn-90s btn-90s-danger px-2 py-0 text-xs">×</button>
          </div>
        </div>

        {/* Window content */}
        <div className="panel-90s-content p-4 sm:p-6 md:p-8">
          <div className="text-center space-y-4">
            {/* Rainbow animated title */}
            <h1 className="heading-90s text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-rainbow">
              Movie is All you need.
            </h1>

            <p className="text-base sm:text-lg md:text-xl font-bold">
              No more awkward movie nights.
            </p>

            {/* NEW! Badge */}
            <div className="inline-block">
              <span className="inline-block bg-[#FF0000] text-white font-bold px-3 py-1 text-sm animate-pulse-glow bevel-outset">
                🔥 NEW! 🔥
              </span>
            </div>

            {/* Search box */}
            <div className="pt-4 max-w-xl mx-auto">
              <MovieSearch />
            </div>
          </div>
        </div>
      </section>

      {/* Groove divider */}
      <div className="hr-groove my-6"></div>

      {/* Movie Grid Section - Windows 95 Window Style */}
      <section className="window-90s">
        {/* Title bar */}
        <div className="win95-titlebar flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm sm:text-base">📁 Movie Database</span>
          <div className="hit-counter text-xs py-1 px-2">
            Total: <span className="font-bold">{String(movieCount).padStart(6, '0')}</span> movies
          </div>
        </div>

        {/* Window content */}
        <div className="panel-90s-content p-4">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 border-b-4 border-[#808080] pb-4">
            <div>
              <h2 className="heading-90s text-xl sm:text-2xl md:text-3xl">
                热门精选
              </h2>
              <p className="text-sm mt-1 text-[#808080] mono-90s">
                收录了 {movieCount} 部影史经典
              </p>
            </div>

            {/* Add movie button - 90s style */}
            <Link
              href="/add"
              className="btn-90s btn-90s-success flex items-center justify-center gap-2 no-underline"
            >
              <Plus className="w-5 h-5 stroke-[2px]" />
              <span>添加电影</span>
            </Link>
          </div>

          <MovieInfiniteList initialMovies={initialMovies} initialSort={sortConfig} />
        </div>
      </section>

      {/* Decorative colored squares section */}
      <section className="panel-90s p-4">
        <div className="text-center">
          <p className="font-bold mb-3">🌈 Color Test Pattern 🌈</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <div className="color-square bg-[#FF0000]"></div>
            <div className="color-square bg-[#FF8000]"></div>
            <div className="color-square bg-[#FFFF00]"></div>
            <div className="color-square bg-[#00FF00]"></div>
            <div className="color-square bg-[#00FFFF]"></div>
            <div className="color-square bg-[#0000FF]"></div>
            <div className="color-square bg-[#8000FF]"></div>
            <div className="color-square bg-[#FF00FF]"></div>
          </div>
        </div>
      </section>
    </div>
  );
}
