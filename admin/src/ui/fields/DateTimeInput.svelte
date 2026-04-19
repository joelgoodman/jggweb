<script lang="ts">
  import type { DateTimeField } from '../../core/fields';

  interface Props { field: DateTimeField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();

  let local = $derived.by(() => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  function handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.value) { onChange(''); return; }
    onChange(new Date(input.value).toISOString());
  }
</script>

<label class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>
  <input type="datetime-local" value={local} onchange={handleChange} />
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
