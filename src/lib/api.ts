/**
 * Utility to resolve client API endpoints based on environment and deployment host.
 * If running on a static platform like Vercel, it automatically redirects calls to the active Cloud Run server.
 */
export function getApiUrl(path: string): string {
  // 1. Check if VITE_API_URL is configured as an environment variable (e.g. during Vercel build)
  const envApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (envApiUrl) {
    const base = envApiUrl.endsWith('/') ? envApiUrl.slice(0, -1) : envApiUrl;
    return `${base}${path}`;
  }

  // 2. Check localStorage for a custom or configured API URL
  const storedApiUrl = localStorage.getItem('LAKAY_MARKET_API_URL');
  if (storedApiUrl) {
    const base = storedApiUrl.endsWith('/') ? storedApiUrl.slice(0, -1) : storedApiUrl;
    return `${base}${path}`;
  }

  // 3. Fail-soft logic: if the app is running as an external static SPA
  const currentHost = window.location.hostname;
  const isVercel = currentHost.includes('vercel.app');
  
  if (isVercel) {
    // Rely on vercel.json rewrite proxy rules to handle CORS natively server-to-server
    return path;
  }

  const isExternalSPA = currentHost.includes('github.io') || 
                        currentHost.includes('netlify.app') || 
                        currentHost.includes('pages.dev');

  if (isExternalSPA) {
    // If not Vercel/Render, fallback to pre- url
    const defaultBackend = "https://ais-pre-idvpxbtu36sxo2axfuf3ax-241171538403.us-west2.run.app";
    return `${defaultBackend}${path}`;
  }

  // 4. Fall back to relative path (standard when frontend and backend share the same domain)
  return path;
}
