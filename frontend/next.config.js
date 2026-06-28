/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // @metamask/sdk pide estas dependencias opcionales en su path de Node,
    // pero corremos esto en el navegador -- no existen ni hacen falta.
    // Sin este fallback, el build de Next.js falla al intentar resolverlas.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
