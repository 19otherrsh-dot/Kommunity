import { useEffect } from 'react';

const setTag = (selector, attr, value) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    const [, name] = selector.match(/\[(?:name|property)="(.+)"\]/) || [];
    if (selector.includes('property')) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

/**
 * Sets document title and SEO/OpenGraph meta tags for the current page (client-side,
 * for in-app navigation and link unfurls after hydration).
 * For crawlers, the backend (backend/seo.js) injects the same tags server-side into
 * the initial HTML for public routes (/c/:slug, /c/:slug/about) when serving the
 * built SPA single-origin — so first-paint HTML is fully indexable.
 */
export function useMeta({ title, description, image, url }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) {
      setTag('meta[name="description"]', 'content', description);
      setTag('meta[property="og:description"]', 'content', description);
    }
    if (title) setTag('meta[property="og:title"]', 'content', title);
    if (image) setTag('meta[property="og:image"]', 'content', image);
    if (url) setTag('meta[property="og:url"]', 'content', url);
    setTag('meta[property="og:type"]', 'content', 'website');

    return () => { document.title = prevTitle; };
  }, [title, description, image, url]);
}
