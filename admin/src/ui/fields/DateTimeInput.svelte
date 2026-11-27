<script lang="ts">
  import { untrack } from 'svelte';
  import { isDateOnly, type DateTimeField } from '../../core/fields';

  interface Props { field: DateTimeField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();

  // Fixed by the value the input opened with, so clearing it doesn't switch types.
  const dateOnly = untrack(() => isDateOnly(value));

  let local = $derived.by(() => {
    if (!value) return '';
    if (dateOnly) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  function handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.value || dateOnly) { onChange(input.value); return; }
    onChange(new Date(input.value).toISOString());
  }
</script>

<label class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>
  <input type={dateOnly ? 'date' : 'datetime-local'} value={local} onchange={handleChange} />
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
