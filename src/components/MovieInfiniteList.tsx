'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Movie } from '@/types/movie';
import MovieCard from './MovieCard';
import { fetchMovies } from '@/app/actions';
import type { SortConfig, SortField } from '@/services/movieService';
import { Loader2, Star, Calendar, ArrowUp, ArrowDown, Type } from 'lucide-react';

interface MovieInfiniteListProps {
  initialMovies: Movie[];
  initialSort: SortConfig;
}

interface SortOption {
  field: SortField;
  label: string;
  icon: React.ReactNode;
}

const SORT_OPTIONS: SortOption[] = [
  { field: 'rating', label: '评分', icon: <Star className="w-4 h-4" /> },
  { field: 'releaseDate', label: '首映日期', icon: <Calendar className="w-4 h-4" /> },
  { field: 'title', label: '名称', icon: <Type className="w-4 h-4" /> },
];

/**
 * 将排序配置转换为 URL 参数字符串
 */
function sortConfigToString(config: SortConfig): string {
  return `${config.field}_${config.order}`;
}

export default function MovieInfiniteList({ initialMovies, initialSort }: MovieInfiniteListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [page, setPage] = useState(2);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
  const [isChangingSort, setIsChangingSort] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 当 initialMovies 或 initialSort 变化时重置状态
  useEffect(() => {
    setMovies(initialMovies);
    setPage(2);
    setHasMore(initialMovies.length > 0);
    setSortConfig(initialSort);
    setIsChangingSort(false);
  }, [initialMovies, initialSort]);

  const loadMoreMovies = useCallback(async () => {
    if (loading || !hasMore || isChangingSort) return;

    setLoading(true);
    try {
      const newMovies = await fetchMovies(page, sortConfig);

      if (newMovies.length === 0) {
        setHasMore(false);
      } else {
        setMovies((prev) => [...prev, ...newMovies]);
        setPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load movies:', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, sortConfig, isChangingSort]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isChangingSort) {
          loadMoreMovies();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [loadMoreMovies, hasMore, isChangingSort]);

  // 处理排序按钮点击：同字段切换升降序，不同字段切换到该字段（默认降序）
  const handleSortClick = (field: SortField) => {
    let newConfig: SortConfig;

    if (sortConfig.field === field) {
      // 同一字段：切换升降序
      newConfig = {
        field,
        order: sortConfig.order === 'desc' ? 'asc' : 'desc',
      };
    } else {
      // 不同字段：切换到该字段，默认降序
      newConfig = {
        field,
        order: 'desc',
      };
    }

    updateSort(newConfig);
  };

  // 更新 URL 并触发重新加载
  const updateSort = (newConfig: SortConfig) => {
    if (newConfig.field === sortConfig.field && newConfig.order === sortConfig.order) return;

    setIsChangingSort(true);
    const params = new URLSearchParams(searchParams.toString());

    // 默认值（rating_desc）不需要在 URL 中显示
    if (newConfig.field === 'rating' && newConfig.order === 'desc') {
      params.delete('sort');
    } else {
      params.set('sort', sortConfigToString(newConfig));
    }

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false });
  };

  return (
    <>
      {/* 排序选择器 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-sm text-gray-500 dark:text-gray-400">排序：</span>

        <div className="flex gap-2">
          {SORT_OPTIONS.map((option) => {
            const isActive = sortConfig.field === option.field;
            const isDesc = sortConfig.order === 'desc';

            return (
              <button
                key={option.field}
                onClick={() => handleSortClick(option.field)}
                disabled={isChangingSort}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isActive
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                title={
                  isActive
                    ? `当前${isDesc ? '降序' : '升序'}，点击切换${isDesc ? '升序' : '降序'}`
                    : `按${option.label}排序`
                }
              >
                {option.icon}
                <span>{option.label}</span>
                {/* 当前选中字段显示升降序箭头 */}
                {isActive && (
                  isDesc
                    ? <ArrowDown className="w-4 h-4" />
                    : <ArrowUp className="w-4 h-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 电影网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {movies.map((movie) => (
          <div key={movie.id} className="transform hover:-translate-y-1 transition-transform duration-300">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>

      <div ref={observerTarget} className="flex justify-center py-8 h-20">
        {(loading || isChangingSort) && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>{isChangingSort ? '切换排序中...' : '正在加载更多...'}</span>
          </div>
        )}
        {!hasMore && movies.length > 0 && !isChangingSort && (
          <p className="text-gray-500 text-sm">已经到底啦~</p>
        )}
      </div>
    </>
  );
}
