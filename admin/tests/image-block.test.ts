// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { editorViewCtx, serializerCtx } from '@milkdown/core';
import { TextSelection } from '@milkdown/prose/state';
import { createMarkdownEditor } from '../src/milkdown/markdown';
import { ImageBlock } from '../src/milkdown/blocks';
import type { StorageAdapter } from '../src/core/storage';

async function editorWith(md: string) {
  const editor = createMarkdownEditor({ root: document.createElement('div'), value: md, blocks: [ImageBlock] });
  await editor.create();
  const view = editor.action((ctx) => ctx.get(editorViewCtx));
  const markdown = () => editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)).trim();
  return { editor, view, markdown };
}
/** The range of `text` in the document, as the slash menu captures it. */
function rangeOf(view: import('@milkdown/prose/view').EditorView, text: string) {
  let found = { from: 0, to: 0 };
  view.state.doc.descendants((node, pos) => {
    const at = node.isText ? node.text!.indexOf(text) : -1;
    if (at >= 0) found = { from: pos + at, to: pos + at + text.length };
  });
  return found;
}

URL.createObjectURL = () => 'blob:upload';

/** A picked file. jsdom's File has no arrayBuffer(). */
const picked = (name: string, type: string) =>
  Object.assign(new File(['x'], name, { type }), { arrayBuffer: async () => new ArrayBuffer(1) });

function insert(view: import('@milkdown/prose/view').EditorView, file: File, upload: StorageAdapter['uploadBinary']) {
  const { from, to } = rangeOf(view, '/ima');
  const toast = vi.fn();
  const done = ImageBlock.insert!({
    view,
    from,
    to,
    storage: { uploadBinary: upload } as unknown as StorageAdapter,
    pickFile: async () => file,
    promptInput: () => null,
    showToast: toast,
  });
  return { done, toast };
}

describe('the image block', () => {
  it('refuses an SVG or any other type that is not a raster image', async () => {
    const { view, markdown } = await editorWith('Before.\n\n/ima');
    const upload = vi.fn();
    const { done, toast } = insert(view, picked('x.svg', 'image/svg+xml'), upload);
    await done;
    expect(upload).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/JPEG, PNG/), 'error');
    expect(markdown()).toContain('Before.');
  });

  it('puts the image where the writer asked, even after typing during the upload', async () => {
    const { view, markdown } = await editorWith('First.\n\n/ima\n\nLast.');
    let release!: () => void;
    const upload = vi.fn(() => new Promise<{ path: string; sha: string; content: string }>((r) => (release = () => r({ path: '', sha: '', content: '' }))));
    const { done } = insert(view, picked('My Photo.JPG', 'image/jpeg'), upload);
    await vi.waitFor(() => expect(upload).toHaveBeenCalled());
    // Typing at the start shifts every later position.
    view.dispatch(view.state.tr.insertText('Typed early. ', 1));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    release();
    await done;
    expect(upload.mock.calls[0][0]).toBe('assets/img/my-photo.jpg');
    expect(markdown()).toBe('Typed early. First.\n\n![](/assets/img/my-photo.jpg)\n\nLast.');
  });

  it('inserts nothing into an editor that has gone', async () => {
    const { editor, view } = await editorWith('/ima');
    let release!: () => void;
    const upload = vi.fn(() => new Promise<{ path: string; sha: string; content: string }>((r) => (release = () => r({ path: '', sha: '', content: '' }))));
    const { done, toast } = insert(view, picked('a.png', 'image/png'), upload);
    await vi.waitFor(() => expect(upload).toHaveBeenCalled());
    await editor.destroy();
    release();
    await done;
    expect(toast).toHaveBeenLastCalledWith(expect.stringMatching(/uploaded/i), 'error');
  });
});
