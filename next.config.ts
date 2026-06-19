import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // "Teklif Talepleri" → "Satış Fırsatları" yeniden adlandırması
      { source: "/requests", destination: "/firsatlar", permanent: true },
    ];
  },
};

export default nextConfig;
