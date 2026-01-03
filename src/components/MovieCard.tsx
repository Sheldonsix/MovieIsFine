import Image from "next/image";
import Link from "next/link";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movie/${movie.imdbId}`}>
      <div className="group bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 cursor-pointer">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={movie.poster}
            alt={movie.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute top-3 right-3 backdrop-blur-md bg-black/60 text-yellow-400 px-2.5 py-1 rounded-lg font-black text-sm border border-white/10 shadow-lg">
            {movie.doubanRating}
          </div>
        </div>
        <div className="p-5 space-y-1">
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-50 truncate group-hover:text-indigo-500 transition-colors">
            {movie.title}
          </h3>
          {movie.originalTitle && (
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 truncate uppercase tracking-wider">
              {movie.originalTitle}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 pt-1">导演: {movie.director}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-tight rounded-md border border-gray-100 dark:border-gray-700"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
