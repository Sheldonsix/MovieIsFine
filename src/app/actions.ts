'use server';

import { movies } from '@/data/movies';
import { Movie } from '@/types/movie';

const ITEMS_PER_PAGE = 24;

export async function fetchMovies(page: number): Promise<Movie[]> {
  // Simulate network delay for better UX demonstration (optional)
  // await new Promise(resolve => setTimeout(resolve, 500));

  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  return movies.slice(start, end);
}
