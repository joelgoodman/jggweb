// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import MarkdownInput from '../src/ui/fields/MarkdownInput.svelte';
import { MarkdownField } from '../src/core/fields';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits for the body to open, in the visual editor or as plain text. */
async function opened() {
  for (let i = 0; i < 100 && !document.querySelector('.ProseMirror, .markdown-plain'); i++) await wait(20);
  await wait(50);
}
let app: object | undefined;

function open(value: string) {
  const onChange = vi.fn<(v: string) => void>();
  app = mount(MarkdownInput, {
    target: document.body,
    props: { field: new MarkdownField('body', {}), value, blocks: [], onChange },
  });
  return onChange;
}
function close() {
  if (app) unmount(app);
  app = undefined;
}
function paste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const clipboardData = { getData: (type: string) => (type === 'text/plain' ? text : ''), files: [], items: [] };
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  document.querySelector('.ProseMirror')!.dispatchEvent(event);
}

afterEach(() => {
  close();
  document.body.innerHTML = '';
});

describe('the Markdown editor', () => {
  it('reports an edit with its URL intact', async () => {
    const onChange = open('');
    await opened();
    paste('https://youtu.be/ab_Cd?a=1&t=2');
    await wait(400);
    expect(onChange.mock.lastCall?.[0].trim()).toBe('https://youtu.be/ab_Cd?a=1&t=2');
  });

  it('reports an edit at once when flushed, before the pause', async () => {
    const onChange = open('Old.');
    await opened();
    paste('More.');
    expect(onChange).not.toHaveBeenCalled();
    (app as { flush: () => void }).flush();
    expect(onChange.mock.lastCall?.[0]).toContain('More.');
  });

  // The change listener is debounced, so it can come due after the editor has gone.
  it.each(['Old.', '# Old'])('reports nothing once it has been removed (%s)', async (value) => {
    const onChange = open(value);
    await opened();
    paste('More.');
    close();
    await wait(400);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('a body the visual editor would change', () => {
  it.each(['{% yt "x" %}', ':::tip\nx\n:::', '| a |\n|---|\n| 1 |'])('opens %j as plain text', async (value) => {
    const onChange = open(value);
    await opened();
    expect(document.querySelector('.ProseMirror')).toBeNull();
    const plain = document.querySelector<HTMLTextAreaElement>('textarea.markdown-plain')!;
    expect(plain.value).toBe(value);
    expect(document.body.textContent).toContain(
      "This entry uses Markdown the visual editor can't keep intact, so it's open as plain text. Nothing is changed until you edit it.",
    );
    expect(onChange).not.toHaveBeenCalled();
    plain.value = `${value}\n\nMore.`;
    plain.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(`${value}\n\nMore.`);
  });
});

describe('a body the visual editor keeps', () => {
  it('reports it as loaded once an edit is undone', async () => {
    const onChange = open('- a\n- b\n');
    await opened();
    expect(document.querySelector('.markdown-plain')).toBeNull();
    paste('More.');
    await wait(400);
    expect(onChange.mock.lastCall?.[0]).toContain('More.');
    const undo = { key: 'z', ctrlKey: true, metaKey: navigator.platform.startsWith('Mac'), bubbles: true, cancelable: true };
    document.querySelector('.ProseMirror')!.dispatchEvent(new KeyboardEvent('keydown', undo));
    await wait(400);
    expect(onChange.mock.lastCall?.[0]).toBe('- a\n- b\n');
  });

  it('opens nothing once removed while it was being checked', async () => {
    const onChange = open('Old.');
    const host = document.querySelector('.markdown-input')!;
    close();
    await wait(400);
    expect(host.querySelector('.ProseMirror, .markdown-plain')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
