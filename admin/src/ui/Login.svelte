<script lang="ts">
  import { signIn, showToast } from '../state.svelte';

  let owner = $state('joelgoodman');
  let repo = $state('jggweb');
  let branch = $state('main');
  let token = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (!token.trim()) {
      showToast('Token is required', 'error');
      return;
    }
    busy = true;
    try {
      // Sanity-check the token by fetching the branch.
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.trim()}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${text.slice(0, 200)}`);
      }
      signIn({ owner, repo, branch, token: token.trim() });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sign-in failed', 'error');
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <form class="login__card" onsubmit={submit}>
    <h1>Sign in</h1>
    <p class="login__hint">Use a GitHub fine-grained personal access token with <strong>Contents: Read & write</strong> on the repository.</p>

    <label>
      <span>Owner</span>
      <input type="text" bind:value={owner} required />
    </label>

    <label>
      <span>Repo</span>
      <input type="text" bind:value={repo} required />
    </label>

    <label>
      <span>Branch</span>
      <input type="text" bind:value={branch} required />
    </label>

    <label>
      <span>Token</span>
      <input type="password" bind:value={token} autocomplete="off" required />
    </label>

    <button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
  </form>
</div>
