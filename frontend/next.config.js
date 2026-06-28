/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @metamask/sdk (vía wagmi) referencia 'pino-pretty' y 'encoding' como
  // dependencias opcionales de su rama de Node. Ninguna de las dos está
  // instalada a propósito -- no hacen falta en el navegador, y el propio
  // paquete maneja su ausencia en runtime. Sin esto, el build falla al
  // intentar resolverlas tanto del lado servidor como del lado cliente.
  serverExternalPackages: ["pino-pretty", "encoding"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
