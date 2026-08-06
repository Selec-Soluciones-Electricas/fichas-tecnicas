export const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const textToHtml = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\r?\n\r?\n+/)
    .map((block) => `<div>${escapeHtml(block).split(/\r?\n/).join("<br/>")}</div>`)
    .join("");
};

// Extraction sources (PDF/AI import, legacy saved data) hand us plain text.
// The rich-text editor stores real HTML. Treat anything without tags as legacy plain text.
export const normalizeDescHtml = (value: string): string =>
  looksLikeHtml(value) ? value : textToHtml(value);

// Defense-in-depth for content that reached the DOM via contentEditable paste,
// before it's played back through dangerouslySetInnerHTML in the preview/PDF.
export const sanitizeDescHtml = (html: string): string =>
  html
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*"(?:\s*javascript:|data:text\/html)[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(?:\s*javascript:|data:text\/html)[^']*'/gi, "$1='#'");
