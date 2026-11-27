<script lang="ts">
  import type { SlugField } from '../../core/fields';
  import { slugify } from '../../core/fields';

  interface Props { field: SlugField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();

  // Leaving the field tidies only what was typed, never a slug read from a file.
  let edited = false;
</script>

<label class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>
  <input
    type="text"
    {value}
    oninput={(e) => {
      edited = true;
      onChange((e.target as HTMLInputElement).value);
    }}
    onblur={(e) => {
      if (!edited) return;
      edited = false;
      const cleaned = slugify((e.target as HTMLInputElement).value);
      if (cleaned !== value) onChange(cleaned);
    }}
    placeholder="lowercase-with-hyphens"
  />
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
