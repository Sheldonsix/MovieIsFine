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

  // 解析排序参数，默认按评分降序排序
  const sortConfig: SortConfig = params.sort
    ? parseSortString(params.sort)
    : { field: "rating", order: "desc" };

  // Initial load of the first page with sort parameter
  const initialMovies = await fetchMovies(1, sortConfig);
  const movieCount = await fetchMovieCount();

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative z-10 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-2xl dark:shadow-purple-900/20">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-3xl"></div>
        </div>

        <div className="relative z-10 px-8 py-24 md:py-32 text-center space-y-8">
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter drop-shadow-lg">
            Movie is All you need.
          </h1>
          <p className="text-lg md:text-2xl text-white/90 max-w-2xl mx-auto font-medium leading-relaxed">
            No more awkward movie nights.
          </p>
          {/* 搜索框 */}
          <div className="pt-4">
            <MovieSearch />
          </div>
        </div>
      </section>

      {/* Movie Grid Section */}
      <section>
        <div className="flex items-end justify-between mb-8 px-2">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              热门精选
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              收录了 {movieCount} 部影史经典
            </p>
          </div>
          {/* 添加电影按钮 */}
          <Link
            href="/add"
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              bg-gradient-to-r from-teal-500 to-emerald-500
              hover:from-teal-600 hover:to-emerald-600
              text-white font-medium shadow-lg shadow-teal-500/25
              hover:shadow-teal-500/40 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">添加电影</span>
          </Link>
        </div>

        <MovieInfiniteList initialMovies={initialMovies} initialSort={sortConfig} />
      </section>
    </div>
  );
}
