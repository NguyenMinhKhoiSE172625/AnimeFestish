import { useEffect } from "react";

const SITE_NAME = "AnimeFetish";
const SITE_URL = "https://animefetish.id.vn";
const DEFAULT_IMAGE = `${SITE_URL}/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png`;

function setMeta(name, content) {
  let el =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    if (name.startsWith("og:") || name.startsWith("article:")) {
      el.setAttribute("property", name);
    } else {
      el.setAttribute("name", name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export function useSEO({ title, description, image, url, type, jsonLd } = {}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | ${SITE_NAME}`
      : `${SITE_NAME} — Xem Anime Vietsub HD Miễn Phí | Kho Anime Nhật Bản Lớn Nhất`;
    const desc =
      description ||
      "AnimeFetish - Xem anime Nhật Bản vietsub miễn phí chất lượng cao Full HD.";
    const img = image || DEFAULT_IMAGE;
    const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL;
    const ogType = type || "website";

    document.title = fullTitle;
    setMeta("description", desc);
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", img);
    setMeta("og:url", fullUrl);
    setMeta("og:type", ogType);
    setMeta("og:site_name", SITE_NAME);
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", img);
    setMeta("twitter:url", fullUrl);
    setCanonical(fullUrl);

    let ldEl = document.getElementById("dynamic-ld-json");
    if (jsonLd) {
      if (!ldEl) {
        ldEl = document.createElement("script");
        ldEl.id = "dynamic-ld-json";
        ldEl.type = "application/ld+json";
        document.head.appendChild(ldEl);
      }
      ldEl.textContent = JSON.stringify(jsonLd);
    } else if (ldEl) {
      ldEl.remove();
    }
  }, [title, description, image, url, type, jsonLd]);
}
