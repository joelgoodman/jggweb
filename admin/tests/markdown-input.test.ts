// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import MarkdownInput from '../src/ui/fields/MarkdownInput.svelte';
import { MarkdownField } from '../src/core/fields';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
    await wait(100);
    paste('https://youtu.be/ab_Cd?a=1&t=2');
    await wait(400);
    expect(onChange.mock.lastCall?.[0].trim()).toBe('https://youtu.be/ab_Cd?a=1&t=2');
  });

  // The change listener is debounced, so it can come due after the editor has gone.
  it.each(['Old.', '# Old'])('reports nothing once it has been removed (%s)', async (value) => {
    const onChange = open(value);
    await wait(100);
    paste('More.');
    close();
    await wait(400);
    expect(onChange).not.toHaveBeenCalled();
  });
});
