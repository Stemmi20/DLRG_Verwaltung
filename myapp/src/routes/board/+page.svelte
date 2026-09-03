<script lang="ts">
	import Login from '$lib/fleetcomponents/Login.svelte';
	import Dashboard from '$lib/fleetcomponents/Dashboard.svelte';
	import { defaultConfig, initialVehicles } from '$lib/fleet/config';
	import type { AppConfig, Vehicle } from '$lib/fleet/types';
	let {
		config = {},
		vehicles = initialVehicles,
	}: { config?: Partial<AppConfig>; vehicles?: Vehicle[] } = $props();
	const settings = $derived({ ...defaultConfig, ...config });
	let authenticated = $state(false);
	function login(username: string, password: string): boolean {
		const valid =
			username.toLowerCase() === settings.username.toLowerCase() && password === settings.password;
		if (valid) authenticated = true;
		return valid;
	}
</script>

<svelte:head><title>DLRG Friedrichshafen · Fahrzeugortung</title></svelte:head>
{#if authenticated}<Dashboard
		config={settings}
		initialVehicles={vehicles}
		onlogout={() => (authenticated = false)}
	/>{:else}<Login onlogin={login} />{/if}
F
