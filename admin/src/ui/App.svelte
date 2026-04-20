<script lang="ts">
  import { store, config, navigate, signOut } from '../state.svelte';
  import Login from './Login.svelte';
  import EntryList from './EntryList.svelte';
  import EntryEditor from './EntryEditor.svelte';
  import Toast from './Toast.svelte';
  import Icon from './Icon.svelte';

  let currentCollection = $derived.by(() => {
    const name = store.route.collection ?? config.collections[0]?.name;
    return config.collections.find((c) => c.name === name) ?? null;
  });

  $effect(() => {
    // On first render or when config changes, pick the first collection for bare-root route.
    if (store.auth && store.route.name === 'list' && !store.route.collection) {
      const first = config.collections[0];
      if (first) navigate({ name: 'list', collection: first.name });
    }
  });
</script>

{#if !store.auth || store.route.name === 'login'}
  <Login />
{:else}
  <div class="shell">
    <aside class="sidebar">
      <header class="brand">
        <h1>jgg CMS</h1>
      </header>
      <nav class="nav">
        <p class="nav__label">Collections</p>
        <ul>
          {#each config.collections as c (c.name)}
            <li>
              <button
                class="nav__link"
                class:is-active={store.route.collection === c.name}
                onclick={() => navigate({ name: 'list', collection: c.name })}
              >
                {c.label}
              </button>
            </li>
          {/each}
        </ul>
      </nav>
      <footer class="sidebar__footer">
        <span class="sidebar__user">{store.auth.owner}/{store.auth.repo}</span>
        <button
          class="sidebar__signout"
          onclick={signOut}
        >
          <Icon name="arrow-door-out" size="0.9rem" />
          Sign out
        </button>
      </footer>
    </aside>

    <main class="main">
      {#if !currentCollection}
        <p class="empty">No collection selected.</p>
      {:else if store.route.name === 'list'}
        <EntryList collection={currentCollection} />
      {:else if store.route.name === 'editor'}
        <EntryEditor collection={currentCollection} entryKey={store.route.entry ?? 'new'} />
      {/if}
    </main>
  </div>
{/if}

<Toast />
