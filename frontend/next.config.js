/** @type {import('next').NextConfig} */

// Only proxy to the backend when a real external URL is configured.
// Without this guard, the rewrite would forward /api/* to localhost:8000
// (a private IP), triggering DNS_HOSTNAME_RESOLVED_PRIVATE on Vercel.
const backendUrl = process.env.BACKEND_URL;
const hasExternalBackend =
  backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1");

const nextConfig = hasExternalBackend
  ? {
      async rewrites() {
        return [
          {
            source: "/api/:path*",
            destination: `${backendUrl}/api/:path*`,
          },
        ];
      },
    }
  : {};

module.exports = nextConfig;
