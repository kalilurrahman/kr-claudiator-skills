import { useEffect } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
}

/**
 * Lightweight per-route SEO head updater.
 * Sets <title>, meta description, canonical link, and og:* tags.
 * Restores prior title on unmount.
 */
export function SeoHead({ title, description, canonical, ogType = "website" }: SeoHeadProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [, key, val] = selector.match(/\[(name|property)="([^"]+)"\]/) || [];
        if (key && val) el.setAttribute(key, val);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:type"]', "content", ogType);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);

    if (canonical) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
      setMeta('meta[property="og:url"]', "content", canonical);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, ogType]);

  return null;
}

export default SeoHead;
