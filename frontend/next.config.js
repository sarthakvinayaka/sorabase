/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return {
      // afterFiles: Next.js API routes are checked first; only unmatched paths reach the backend
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
