import type { CookieOptions } from "express";
import type { SignOptions } from "jsonwebtoken";

type ExpiresIn = NonNullable<SignOptions["expiresIn"]>;

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

const jwtConfig = {
  access: {
    secret: process.env.JWT_ACCESS_SECRET!,
    expiresIn: "15m" as ExpiresIn,
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: "7d" as ExpiresIn,
    expiresInMs: MS_7_DAYS,
  },
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MS_7_DAYS,
    path: "/",
  } satisfies CookieOptions,
};

export default jwtConfig;
