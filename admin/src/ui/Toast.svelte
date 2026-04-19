<script lang="ts">
  import { store } from '../state.svelte';
  import Icon from './Icon.svelte';
</script>

{#if store.toast}
  <div class="toast toast--{store.toast.kind}" role="status">
    <Icon
      name={store.toast.kind === 'error' ? 'triangle-warning' : 'check'}
      size="1rem"
    />
    <span class="toast__message">{store.toast.message}</span>
  </div>
{/if}
