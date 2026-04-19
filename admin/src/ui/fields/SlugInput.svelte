<script lang="ts">
  import type { SlugField } from '../../core/fields';
  import { slugify } from '../../core/fields';

  interface Props { field: SlugField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();
</script>

<label class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>
  <input
    type="text"
    {value}
    oninput={(e) => onChange((e.target as HTMLInputElement).value)}
    onblur={(e) => {
      const cleaned = slugify((e.target as HTMLInputElement).value);
      if (cleaned !== value) onChange(cleaned);
    }}
    placeholder="lowercase-with-hyphens"
  />
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
