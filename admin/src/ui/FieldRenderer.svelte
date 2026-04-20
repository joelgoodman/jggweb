<script lang="ts">
  import type { Field } from '../core/fields';
  import { TextField, SlugField, DateTimeField, ImageField, ObjectField, BooleanField } from '../core/fields';
  import TextInput from './fields/TextInput.svelte';
  import SlugInput from './fields/SlugInput.svelte';
  import DateTimeInput from './fields/DateTimeInput.svelte';
  import ImageInput from './fields/ImageInput.svelte';
  import ObjectInput from './fields/ObjectInput.svelte';
  import BooleanInput from './fields/BooleanInput.svelte';

  interface Props {
    field: Field;
    value: unknown;
    onChange: (value: unknown) => void;
  }
  let { field, value, onChange }: Props = $props();
</script>

<div class="field" data-field-type={field.type} data-field-name={field.name}>
  {#if field instanceof TextField}
    <TextInput {field} value={value as string} onChange={onChange as (v: string) => void} />
  {:else if field instanceof SlugField}
    <SlugInput {field} value={value as string} onChange={onChange as (v: string) => void} />
  {:else if field instanceof DateTimeField}
    <DateTimeInput {field} value={value as string} onChange={onChange as (v: string) => void} />
  {:else if field instanceof ImageField}
    <ImageInput {field} value={value as string} onChange={onChange as (v: string) => void} />
  {:else if field instanceof ObjectField}
    <ObjectInput {field} value={value as Record<string, unknown>} onChange={onChange as (v: Record<string, unknown>) => void} />
  {:else if field instanceof BooleanField}
    <BooleanInput {field} value={value as boolean} onChange={onChange as (v: boolean) => void} />
  {:else}
    <p class="field__unknown">No renderer for field type: {field.type}</p>
  {/if}
</div>
