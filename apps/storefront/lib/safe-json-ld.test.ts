import { describe, it, expect } from 'vitest';
import { safeJsonLd } from './safe-json-ld';

describe('safeJsonLd', () => {
  it('escapes </script> so it cannot break out of a JSON-LD script block', () => {
    const output = safeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(output).not.toContain('</script>');
    expect(output).not.toContain('<script>');
  });

  it('replaces < with \\u003c and > with \\u003e', () => {
    const output = safeJsonLd({ name: '<b>bold</b>' });
    expect(output).toContain('\\u003c');
    expect(output).toContain('\\u003e');
    expect(output).not.toContain('<b>');
  });

  it('replaces & with \\u0026', () => {
    const output = safeJsonLd({ name: 'foo & bar' });
    expect(output).toContain('\\u0026');
    expect(output).not.toContain('&"');
  });

  it('produces valid JSON that round-trips to the original value', () => {
    const original = { name: '</script><script>alert(1)</script>', price: 42 };
    const output = safeJsonLd(original);
    const parsed = JSON.parse(output) as typeof original;
    expect(parsed.name).toBe(original.name);
    expect(parsed.price).toBe(42);
  });

  it('handles nested objects and arrays without corrupting structure', () => {
    const data = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: 'Widget </script> &amp; More',
      offers: [{ price: 100, currency: 'USD' }],
    };
    const output = safeJsonLd(data);
    expect(output).not.toContain('</script>');
    const parsed = JSON.parse(output) as typeof data;
    expect(parsed['@type']).toBe('Product');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(parsed.offers[0]!.price).toBe(100);
  });

  it('leaves ordinary strings untouched aside from standard JSON quoting', () => {
    const output = safeJsonLd({ name: 'Hello World', count: 3 });
    expect(output).toBe('{"name":"Hello World","count":3}');
  });
});
