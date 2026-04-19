<script lang="ts">
  import type { ObjectField } from '../../core/fields';
  import FieldRenderer from '../FieldRenderer.svelte';

  interface Props {
    field: ObjectField;
    value: Record<string, unknown>;
    onChange: (v: Record<string, unknown>) => void;
  }
  let { field, value, onChange }: Props = $props();

  function updateChild(name: string, v: unknown) {
    onChange({ ...value, [name]: v });
  }
</script>

<fieldset class="object">
  <legend>{field.label}{field.required ? ' *' : ''}</legend>
  {#each field.fields as child (child.name)}
    <FieldRenderer
      field={child}
      value={value?.[child.name]}
      onChange={(v) => updateChild(child.name, v)}
    />
  {/each}
</fieldset>
