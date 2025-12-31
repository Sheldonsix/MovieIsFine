import Image from "next/image";
import Link from "next/link";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movie/${movie.imdbId}`}>
      <div className="group bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={movie.poster}
            alt={movie.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-md font-bold text-sm">
            {movie.doubanRating}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 truncate">
            {movie.title}
          </h3>
          {movie.originalTitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {movie.originalTitle}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">导演: {movie.director}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
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
