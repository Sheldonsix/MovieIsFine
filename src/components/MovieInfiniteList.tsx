'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Movie } from '@/types/movie';
import MovieCard from './MovieCard';
import { fetchMovies } from '@/app/actions';
import { Loader2 } from 'lucide-react';

interface MovieInfiniteListProps {
  initialMovies: Movie[];
}

export default function MovieInfiniteList({ initialMovies }: MovieInfiniteListProps) {
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [page, setPage] = useState(2); // Start from page 2 since page 1 is passed as initialMovies
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadMoreMovies = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newMovies = await fetchMovies(page);

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
  }, [page, loading, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreMovies();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [loadMoreMovies, hasMore]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {movies.map((movie) => (
          <div key={movie.id} className="transform hover:-translate-y-1 transition-transform duration-300">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>

      <div ref={observerTarget} className="flex justify-center py-8 h-20">
        {loading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>正在加载更多...</span>
          </div>
        )}
        {!hasMore && movies.length > 0 && (
          <p className="text-gray-500 text-sm">已经到底啦~</p>
        )}
      </div>
    </>
  );
}
