/** Pagination helpers shared by list endpoints. */
import type { Meta } from './httpError';

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>, maxPageSize = 50): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageMeta(p: PageParams, total: number): Meta {
  return {
    page: p.page,
    pageSize: p.pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}
