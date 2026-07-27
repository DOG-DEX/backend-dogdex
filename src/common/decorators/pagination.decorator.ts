import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  search?: string;
}

export const Pagination = createParamDecorator(
  (
    options: { defaultLimit?: number; maxLimit?: number } = {},
    ctx: ExecutionContext,
  ): PaginationParams => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query || {};

    const rawPage = parseInt(query.page, 10);
    const rawLimit = parseInt(query.limit, 10);

    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    const defaultLimit = options.defaultLimit || 20;
    const maxLimit = options.maxLimit || 100;

    let limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
    if (limit > maxLimit) {
      limit = maxLimit;
    }

    const skip = (page - 1) * limit;
    const search =
      typeof query.search === 'string' ? query.search.trim() : undefined;

    return { page, limit, skip, search };
  },
);
