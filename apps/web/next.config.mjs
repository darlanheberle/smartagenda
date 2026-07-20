/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing-agenda-smart.html"
      }
    ];
  }
};

export default nextConfig;
