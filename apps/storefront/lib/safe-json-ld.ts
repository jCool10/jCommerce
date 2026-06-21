/**
 * JSON.stringify does NOT escape `</script>` -- a value like
 * `</script><script>alert(1)</script>` inside a
 * `<script type="application/ld+json">` block closes the surrounding script
 * element and injects arbitrary JS (stored XSS). We escape five characters that
 * can break out of a script tag or corrupt HTML parsing. U+2028/U+2029 are valid
 * JSON string characters but treated as line terminators by some JS engines when
 * embedded raw in script content. The resulting Unicode escapes are valid JSON and
 * transparently decoded by JSON.parse, so SEO crawlers read the correct values.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
