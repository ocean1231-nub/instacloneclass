import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const siteUrl = env.VITE_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  let site;
  if (siteUrl) {
    try {
      site = new URL(siteUrl);
      if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error();
    } catch {
      throw new Error('VITE_PUBLIC_SITE_URL은 경로가 없는 앱의 공개 주소여야 합니다.');
    }
  }
  return {
    plugins: [react(), {
      name: 'share-metadata',
      transformIndexHtml(html) {
        if (!site) return html;
        const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
        return html.replace('content="/og-image.png"', `content="${escape(new URL('/og-image.png', site).href)}"`)
          .replace('<meta property="og:type"', `<meta property="og:url" content="${escape(site.href)}" />\n    <meta property="og:type"`);
      },
    }],
    server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  };
});
