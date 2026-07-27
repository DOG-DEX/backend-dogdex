import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Language = 'vi' | 'en';

export const Lang = createParamDecorator(
  (defaultLang: Language = 'vi', ctx: ExecutionContext): Language => {
    const request = ctx.switchToHttp().getRequest();
    const queryLang = request.query?.lang;

    if (queryLang === 'vi' || queryLang === 'en') {
      return queryLang;
    }

    const headerLang = request.headers?.['accept-language']
      ?.split(',')[0]
      ?.toLowerCase();
    if (headerLang?.startsWith('vi')) {
      return 'vi';
    } else if (headerLang?.startsWith('en')) {
      return 'en';
    }

    return defaultLang;
  },
);
