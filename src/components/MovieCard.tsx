import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movie/${movie.doubanId}`}>
      <div className="group bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 cursor-pointer">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={movie.poster}
            alt={movie.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 backdrop-blur-md bg-black/60 text-yellow-400 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg font-black text-xs sm:text-sm border border-white/10 shadow-lg">
            {movie.doubanRating}
          </div>
        </div>
        <div className="p-2.5 sm:p-4 md:p-5 space-y-0.5 sm:space-y-1">
          <h3 className="font-bold text-sm sm:text-base md:text-lg text-gray-900 dark:text-gray-50 truncate group-hover:text-indigo-500 transition-colors">
            {movie.title}
          </h3>
          {movie.originalTitle && (
            <p className="text-[10px] sm:text-xs font-medium text-gray-400 dark:text-gray-500 truncate uppercase tracking-wider">
              {movie.originalTitle}
            </p>
          )}
          <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 pt-0.5 sm:pt-1">
            <p className="line-clamp-1">导演: {movie.director}</p>
            {movie.releaseDate && (
              <p className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {movie.releaseDate.slice(0, 4)} 年上映
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1.5 sm:mt-3">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-1.5 sm:px-2 py-0.5 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-tight rounded-md border border-gray-100 dark:border-gray-700"
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
