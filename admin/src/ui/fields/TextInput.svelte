<script lang="ts">
  import type { TextField } from '../../core/fields';

  interface Props { field: TextField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();
</script>

<label class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>
  {#if field.multiline}
    <textarea {value} placeholder={field.placeholder} rows="3" oninput={(e) => onChange((e.target as HTMLTextAreaElement).value)}></textarea>
  {:else}
    <input type="text" {value} placeholder={field.placeholder} oninput={(e) => onChange((e.target as HTMLInputElement).value)} />
  {/if}
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
