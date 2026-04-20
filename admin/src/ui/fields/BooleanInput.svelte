<script lang="ts">
  import type { BooleanField } from '../../core/fields';

  interface Props { field: BooleanField; value: boolean; onChange: (v: boolean) => void }
  let { field, value, onChange }: Props = $props();
</script>

<label class="input input--inline">
  <input
    type="checkbox"
    checked={!!value}
    onchange={(e) => onChange((e.target as HTMLInputElement).checked)}
  />
  <span class="input__label">{field.checkboxLabel ?? field.label}</span>
  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</label>
