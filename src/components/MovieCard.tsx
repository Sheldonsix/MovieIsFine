import Image from "next/image";
import Link from "next/link";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movie/${movie.doubanId}`} className="block no-underline">
      <div className="window-90s h-full">
        {/* Title bar */}
        <div className="win95-titlebar text-xs truncate px-2 py-1">
          🎬 {movie.title}
        </div>

        {/* Poster with bevel inset */}
        <div className="bevel-inset m-1">
          <div className="relative aspect-2/3 overflow-hidden">
            <Image
              src={movie.poster}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {/* Rating badge - 90s style */}
            <div className="absolute top-1 right-1 bevel-outset bg-[#FFFF00] px-2 py-0.5">
              <span className="mono-90s text-sm font-bold text-black">
                {movie.doubanRating}
              </span>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="p-2 space-y-1 bg-[#C0C0C0]">
          <h3 className="font-bold text-sm text-black truncate">
            {movie.title}
          </h3>
          {movie.originalTitle && (
            <p className="text-[10px] font-bold text-[#808080] truncate uppercase tracking-wide">
              {movie.originalTitle}
            </p>
          )}
          <div className="space-y-0.5 text-xs text-black">
            <p className="truncate">导演: {movie.director}</p>
            {movie.releaseDate && (
              <p className="text-[#808080] mono-90s text-[10px]">
                📅 {movie.releaseDate.slice(0, 4)} 年上映
              </p>
            )}
          </div>
          {/* Genre tags - 90s colored */}
          <div className="flex flex-wrap gap-1 pt-1">
            {movie.genres.slice(0, 3).map((genre, index) => {
              const colors = ['#FF0000', '#00AA00', '#0000FF'];
              const bgColor = colors[index % colors.length];
              return (
                <span
                  key={genre}
                  className="bevel-outset px-1.5 py-0.5 text-[8px] font-bold uppercase text-white"
                  style={{ backgroundColor: bgColor }}
                >
                  {genre}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}
