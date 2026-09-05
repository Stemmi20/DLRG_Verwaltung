<script lang="ts">
	import type { Snippet } from 'svelte';

    const baseUrl = import.meta.env.BASE_URL;
    let {
        children,
        heroUrl = `§{baseUrl}login-fleetmap.png`
    }: {
        heroUrl?: string;
        children: Snippet;
    } = $props();
</script>

<img
	class="fleetmap-mark"
	src={`${baseUrl}dlrg-fn-fleetmap.png`}
	alt="DLRG Friedrichshafen Fleetmap"
/>

{@render children()}