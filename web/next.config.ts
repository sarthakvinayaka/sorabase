import type { NextConfig } from "next";

/** FastAPI origin for dev rewrites only. Do not use SERVER_API_URL here — in many setups that is the Postgres URL. */
const raw = (process.env.API_PROXY_ORIGIN ?? "").trim().replace(/\/+$/, "");
const apiOrigin =
  raw.startsWith("http://") || raw.startsWith("https://") ? raw : "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
