import { movies } from "@/data/movies";
import MovieCard from "@/components/MovieCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center">
            MovieIsFine
          </h1>
          <p className="text-gray-300 text-center mt-2">
            Move is all you need.
          </p>
        </div>
      </header>

      {/* Movie Grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">热门电影</h2>
          <span className="text-gray-500">共 {movies.length} 部</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>MovieIsFine</p>
        </div>
      </footer>
    </div>
  );
}
