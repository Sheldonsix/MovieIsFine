import { movies } from "@/data/movies";
import MovieCard from "@/components/MovieCard";

export default function Home() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-2xl dark:shadow-purple-900/20">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-soft-light"></div>
        <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-3xl"></div>
        
        <div className="relative px-8 py-20 md:py-28 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-md">
            Movie is all you need.
          </h1>
          <p className="text-lg md:text-2xl text-indigo-100 max-w-2xl mx-auto font-medium">
            Find your favorite movie.
          </p>
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
              收录了 {movies.length} 部影史经典
            </p>
          </div>
          {/* 这里可以放筛选器或排序按钮 */}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {movies.map((movie) => (
            <div key={movie.id} className="transform hover:-translate-y-1 transition-transform duration-300">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}