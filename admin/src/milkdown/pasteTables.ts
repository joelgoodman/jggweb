import { Plugin } from '@milkdown/prose/state';

/**
 * Pasted HTML with its tables written out as text: one paragraph per row,
 * cells separated by ` | `. The editor has no tables, and would otherwise run
 * every cell together. Says whether there were any.
 */
export function tablesAsText(html: string): { html: string; tables: number } {
  if (!/<table[\s>]/i.test(html)) return { html, tables: 0 };
  const template = document.createElement('template');
  template.innerHTML = html;
  const tables = [...template.content.querySelectorAll('table')];
  // Innermost first, so a table inside a cell is text before its cell is read.
  for (const table of tables.reverse()) {
    const rows = [...table.querySelectorAll('tr')].filter((row) => row.closest('table') === table);
    const paragraphs = rows.map((row) => {
      const p = document.createElement('p');
      const cells = [...row.children].filter((cell) => /^T[DH]$/.test(cell.tagName));
      p.textContent = cells.map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
      return p;
    });
    table.replaceWith(...paragraphs);
  }
  return { html: template.innerHTML, tables: tables.length };
}

/** Writes pasted tables out as text, and calls `onTable` when it does. */
export function pasteTablesPlugin(onTable: () => void): Plugin {
  return new Plugin({
    props: {
      transformPastedHTML(html) {
        const result = tablesAsText(html);
        if (result.tables) onTable();
        return result.html;
      },
    },
  });
}
