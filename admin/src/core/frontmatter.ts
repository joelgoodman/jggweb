import YAML from 'yaml';

export interface ParsedEntry {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseEntry(raw: string): ParsedEntry {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: {}, body: raw };
  const frontmatter = (YAML.parse(m[1]) ?? {}) as Record<string, unknown>;
  return { frontmatter, body: m[2] ?? '' };
}

export function stringifyEntry(frontmatter: Record<string, unknown>, body: string): string {
  const fm = YAML.stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  }).trimEnd();
  const bodyTrimmed = body.replace(/^\s+/, '');
  return `---\n${fm}\n---\n\n${bodyTrimmed}\n`;
}
