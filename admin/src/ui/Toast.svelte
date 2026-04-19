<script lang="ts">
  import { store } from '../state.svelte';
</script>

{#if store.toast}
  <div class="toast toast--{store.toast.kind}" role="status">
    {store.toast.message}
  </div>
{/if}
