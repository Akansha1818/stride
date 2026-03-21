const parseBoolean = (value, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
};

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = parseBoolean(process.env.COOKIE_SECURE, isProduction);
  const sameSite = process.env.COOKIE_SAME_SITE || (secure ? "none" : "lax");
  const domain = process.env.COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
};

module.exports = {
  getCookieOptions,
};
