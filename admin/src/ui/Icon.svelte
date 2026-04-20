<script lang="ts" module>
  /**
   * All icon SVGs ship as eager, raw string imports. Using a glob
   * means adding an icon is a one-file operation — drop `foo.svg`
   * into icons/, then `<Icon name="foo" />` works everywhere.
   *
   * Nucleo emits icons with a hard-coded `fill="#F7F7F7"` on the outer
   * <g>. We rewrite that at import time so the icon inherits its
   * host's color via `currentColor` — one icon works in the dark
   * inline toolbar, the light block toolbar, success/error toasts,
   * anywhere. The `data-color="color-2"` attribute is preserved but
   * left styled the same as the primary path: the site uses the
   * single-tone variants of these glyphs.
   */
  const rawIcons = import.meta.glob('./icons/*.svg', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;

  function normalize(raw: string): string {
    return raw
      .replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="currentColor"')
      .replace(/\swidth="\d+"/, ' width="1em"')
      .replace(/\sheight="\d+"/, ' height="1em"');
  }

  const iconCache = new Map<string, string>();
  for (const [path, raw] of Object.entries(rawIcons)) {
    const name = path.replace(/^\.\/icons\//, '').replace(/\.svg$/, '');
    iconCache.set(name, normalize(raw));
  }

  export function hasIcon(name: string): boolean {
    return iconCache.has(name);
  }
</script>

<script lang="ts">
  interface Props {
    name: string;
    size?: string;
    class?: string;
    'aria-label'?: string;
  }
  let {
    name,
    size = '1em',
    class: className = '',
    'aria-label': ariaLabel,
    ...rest
  }: Props = $props();

  const svg = $derived(iconCache.get(name) ?? '');
</script>

<span
  class="icon {className}"
  style:font-size={size}
  role={ariaLabel ? 'img' : undefined}
  aria-label={ariaLabel}
  aria-hidden={ariaLabel ? undefined : 'true'}
  {...rest}
>
  {@html svg}
</span>
