import { describe, it, expect } from 'vitest';

const NOTICE =
  'Copyright © Nucleo — https://nucleoapp.com/ — Redistribution of icons is prohibited. Icons are restricted for use only within the product they are bundled with.';

const raw = (files: Record<string, unknown>) => Object.entries(files) as [string, string][];
const icons = raw(import.meta.glob('../src/ui/icons/*.svg', { eager: true, query: '?raw', import: 'default' }));
const notices = raw(import.meta.glob('../src/ui/icons/COPYRIGHT.txt', { eager: true, query: '?raw', import: 'default' }));

describe('Nucleo icon notice', () => {
  it('finds the icons', () => expect(icons.length).toBeGreaterThan(0));

  it.each(icons)('%s carries the notice inside <svg>', (_path, svg) =>
    expect(svg).toMatch(new RegExp(`^<svg[^>]*><!-- ${NOTICE.replaceAll('.', '\\.')} -->[\\s\\S]*</svg>\\s*$`)));

  it('ships COPYRIGHT.txt beside the icons', () =>
    expect(notices.map(([, text]) => text.trim())).toEqual([NOTICE]));
});
