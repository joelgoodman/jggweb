import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive';
import type { Processor } from 'unified';
import type {} from 'remark-parse';
import type {} from 'remark-stringify';

const COLON = 58;

/**
 * `::: name … :::` blocks, and no other directive syntax. remark-directive also
 * reads `word:word` as an inline directive, which no block here handles, and
 * escapes such colons on the way out.
 */
export function remarkContainerDirective(this: Processor) {
  const data = this.data();
  // The package only exports all three constructs together; the container one
  // is listed first at the start of a line.
  const [container] = [directive().flow![COLON]!].flat();
  const { handlers, unsafe } = directiveToMarkdown();

  (data.micromarkExtensions ??= []).push({ flow: { [COLON]: container } });
  (data.fromMarkdownExtensions ??= []).push(directiveFromMarkdown());
  (data.toMarkdownExtensions ??= []).push({
    handlers: { containerDirective: handlers!.containerDirective },
    unsafe: [
      ...(unsafe ?? []).filter((pattern) => pattern.character !== ':'),
      // Only a line starting with three colons would open a container.
      { atBreak: true, character: ':', after: '::' },
    ],
  });
}
