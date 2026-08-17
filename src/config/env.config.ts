import { z } from 'zod';
import { logger } from '../common/utils/logger.util';

const durationSchema = z.string().regex(/^\d+[smhdw]$/, {
  message: 'must be a duration such as 15m, 7d, or 1h',
});

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    MONGO_URI: z.string().min(1),

    JWT_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters; use a generated secret'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters; use a generated secret'),
    JWT_ACCESS_EXPIRES_IN: durationSchema.optional(),
    JWT_REFRESH_EXPIRES_IN: durationSchema.optional(),
    // Backward-compatible aliases. Remove after deployment configuration is migrated.
    JWT_ACCESS_EXPIRATION: durationSchema.optional(),
    JWT_REFRESH_EXPIRATION: durationSchema.optional(),

    USE_REDIS: z.coerce.boolean().default(false),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_URL: z.string().optional(),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),

    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),

    MOMO_PARTNER_CODE: z.string().optional(),
    MOMO_ACCESS_KEY: z.string().optional(),
    MOMO_SECRET_KEY: z.string().optional(),
    MOMO_HOSTNAME: z.string().optional(),

    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    BACKEND_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.coerce.boolean().default(false),
  })
  .transform((config, ctx) => {
    const accessExpiration =
      config.JWT_ACCESS_EXPIRES_IN ?? config.JWT_ACCESS_EXPIRATION ?? '15m';
    const refreshExpiration =
      config.JWT_REFRESH_EXPIRES_IN ?? config.JWT_REFRESH_EXPIRATION ?? '7d';

    if (config.NODE_ENV === 'production' && !config.CORS_ORIGINS?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'is required in production and must contain an allowlist of frontend origins',
      });
    }

    return {
      ...config,
      GEMINI_API_KEY: config.GEMINI_API_KEY ?? config.GOOGLE_API_KEY,
      JWT_ACCESS_EXPIRES_IN: accessExpiration,
      JWT_REFRESH_EXPIRES_IN: refreshExpiration,
    };
  });

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    logger.error('Invalid environment variables configuration:');
    parsed.error.issues.forEach((err) => {
      logger.error(`   - [${err.path.join('.')}]: ${err.message}`);
    });
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
};
