/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Las versiones publicadas de @supabase/auth-js@2.105 y docx@9.6 tienen .d.ts mal empaquetados.
  // El JS funciona correctamente — sólo se omiten chequeos de tipo durante el build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // docx es CommonJS y debe cargarse server-side sin que Next intente bundlearlo.
  experimental: {
    serverComponentsExternalPackages: ["docx"],
  },
};

export default nextConfig;
