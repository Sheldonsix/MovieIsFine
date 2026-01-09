"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import Image from "next/image";
import { searchMovies } from "@/app/actions";
import { Movie } from "@/types/movie";

export function MovieSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Handle search input change
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Debounced search
    debounceTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const searchResults = await searchMovies(value);
        setResults(searchResults);
        setIsOpen(true);
        setSelectedIndex(-1);
      });
    }, 300);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigate to movie detail page
  const navigateToMovie = useCallback(
    (doubanId: string) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/movie/${doubanId}`);
    },
    [router]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          navigateToMovie(results[selectedIndex].doubanId);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Search input - 90s style */}
      <div className="relative z-50">
        <div className="bevel-inset bg-white flex items-center">
          <Search
            className="ml-2 text-[#808080] shrink-0"
            size={20}
            strokeWidth={2}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim().length > 0 && setIsOpen(true)}
            placeholder="探索你的下一部电影..."
            className="input-90s flex-1 border-0 shadow-none focus:outline-none"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="btn-90s px-2 py-1 mr-1"
              aria-label="清空搜索"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Search results dropdown - 90s window style */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 window-90s">
          <div className="win95-titlebar text-xs">
            🔍 搜索结果
          </div>
          <div className="panel-90s-content max-h-80 overflow-y-auto">
            {isPending ? (
              <div className="p-2 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-[#E8E8E8]">
                    <div className="w-10 h-14 bg-[#808080]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[#808080] w-3/4" />
                      <div className="h-3 bg-[#808080] w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <ul>
                {results.map((movie, index) => (
                  <li key={movie.doubanId}>
                    <button
                      onClick={() => navigateToMovie(movie.doubanId)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 p-2 text-left border-b-2 border-[#808080] last:border-b-0
                        ${index === selectedIndex
                          ? "bg-[#000080] text-white"
                          : index % 2 === 0
                            ? "bg-[#FFFFFF]"
                            : "bg-[#E8E8E8]"
                        }`}
                    >
                      {/* Movie poster thumbnail */}
                      <div className="bevel-inset p-0.5 shrink-0">
                        <div className="relative w-10 h-14">
                          <Image
                            src={movie.poster}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      </div>
                      {/* Movie info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">
                          {movie.title}
                        </div>
                        <div className={`text-xs mt-0.5 flex items-center gap-2 ${
                          index === selectedIndex ? "text-white/80" : "text-[#808080]"
                        }`}>
                          <span className="mono-90s">
                            {movie.releaseDate.slice(0, 4)}
                          </span>
                          <span className="truncate max-w-[120px]">{movie.director}</span>
                        </div>
                      </div>
                      {/* Rating */}
                      {movie.doubanRating > 0 && (
                        <div className={`shrink-0 bevel-outset px-2 py-1 ${
                          index === selectedIndex ? "bg-[#FFFF00]" : "bg-[#00AA00]"
                        }`}>
                          <span className={`mono-90s text-sm font-bold ${
                            index === selectedIndex ? "text-black" : "text-white"
                          }`}>
                            {movie.doubanRating}
                          </span>
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center bg-[#FFFFCC]">
                <p className="text-sm font-bold">未找到与 &quot;{query}&quot; 相关的电影</p>
                <p className="text-xs text-[#808080] mt-1">换个关键词试试？</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
