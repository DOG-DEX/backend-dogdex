import { CookieOptions } from 'express';

/**
 * Configuration for the Refresh Token HttpOnly Cookie.
 */
export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
};
