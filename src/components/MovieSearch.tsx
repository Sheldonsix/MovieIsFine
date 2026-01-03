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

  // 处理搜索输入变化
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // 防抖搜索
    debounceTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const searchResults = await searchMovies(value);
        setResults(searchResults);
        setIsOpen(true);
        setSelectedIndex(-1);
      });
    }, 300);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 点击外部关闭下拉框
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

  // 跳转到电影详情页
  const navigateToMovie = useCallback(
    (imdbId: string) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/movie/${imdbId}`);
    },
    [router]
  );

  // 键盘导航
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
          navigateToMovie(results[selectedIndex].imdbId || "");
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // 清空搜索
  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* 搜索输入框 */}
      <div className="relative z-50 group">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors duration-300 z-10 pointer-events-none"
          size={20}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setIsOpen(true)}
          placeholder="探索你的下一部电影..."
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700
            bg-white/90 dark:bg-gray-900/90 backdrop-blur-md
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            shadow-xl hover:shadow-2xl focus:shadow-indigo-500/20
            focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50
            transition-all duration-300 ease-out"
        />
        {query && (
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 ${query ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
          <button
            onClick={clearSearch}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="清空搜索"
          >
            <X size={16} />
          </button>
        </div>
        )}
      </div>

      {/* 搜索结果下拉框 */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 z-50
        rounded-2xl border border-gray-200 dark:border-gray-700
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl
        shadow-2xl shadow-indigo-500/10 dark:shadow-black/50
        overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top"
        >
          {isPending ? (
            <div className="p-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
          ) : results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((movie, index) => (
                <li key={movie.imdbId}>
                  <button
                    onClick={() => navigateToMovie(movie.imdbId || "")}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`group w-full flex items-center gap-4 p-2 rounded-xl text-left transition-all duration-200
                      ${index === selectedIndex
                        ? "bg-indigo-50 dark:bg-indigo-500/10 scale-[0.99]"
                        : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                  >
                    {/* 电影海报缩略图 */}
                    <div className="relative w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow bg-gray-200 dark:bg-gray-700">
                      <Image
                        src={movie.poster}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    {/* 电影信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {movie.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {movie.releaseDate.slice(0, 4)}
                        </span>
                        <span className="truncate max-w-[120px]">{movie.director}</span>
                      </div>
                    </div>
                    {/* 评分 */}
                    {movie.doubanRating > 0 && (
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-amber-500">
                          {movie.doubanRating}
                        </span>
                        <span className="text-[10px] text-gray-400">豆瓣</span>
                    </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 flex flex-col items-center text-center text-gray-500 dark:text-gray-400">

            <p className="text-sm">未找到与 {query} 相关的电影</p>
            <p className="text-xs text-gray-400 mt-1">换个关键词试试？</p>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
