const ALLOWED_TAGS = new Set([
  "b", "i", "em", "strong", "br", "p", "ul", "ol", "li", "a", "span",
]);

export function sanitizeHtml(html) {
  if (!html) return "";
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const lower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(lower)) {
      if (match.startsWith("</")) return `</${lower}>`;
      if (lower === "a") {
        const hrefMatch = match.match(/href=["']([^"']*?)["']/i);
        const href = hrefMatch ? hrefMatch[1] : "#";
        if (href.startsWith("javascript:")) return "";
        return `<a href="${href}" rel="noopener noreferrer" target="_blank">`;
      }
      return `<${lower}>`;
    }
    return "";
  });
}
