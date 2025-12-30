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
    (movieId: string) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/movie/${movieId}`);
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
          navigateToMovie(results[selectedIndex].id);
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
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          size={20}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setIsOpen(true)}
          placeholder="搜索电影、导演、演员..."
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
            transition-all duration-200"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full
              text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="清空搜索"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* 搜索结果下拉框 */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50
          overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {isPending ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              搜索中...
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((movie, index) => (
                <li key={movie.id}>
                  <button
                    onClick={() => navigateToMovie(movie.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-colors
                      ${
                        index === selectedIndex
                          ? "bg-indigo-50 dark:bg-indigo-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                  >
                    {/* 电影海报缩略图 */}
                    <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
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
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {movie.director} · {movie.releaseDate.slice(0, 4)}
                      </div>
                    </div>
                    {/* 评分 */}
                    <div className="flex-shrink-0 text-sm font-semibold text-yellow-500">
                      {movie.doubanRating}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              未找到相关电影
            </div>
          )}
        </div>
      )}
    </div>
  );
}
