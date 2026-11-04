import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    // O hash padrão (xxhash64 em WASM) quebra o build com o recharts no Node 24
    // ("WasmHash._updateWithBuffer ... reading 'length'"). SHA-256 nativo evita o problema.
    config.output.hashFunction = "sha256";
    return config;
  },
};

export default nextConfig;
