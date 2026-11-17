<script lang="ts">
	import type { Icon } from '$lib/navigation';

	/* Einfache Strich-Icons (24×24), damit kein Icon-Paket nötig ist. */
	let { name, groesse = 20 }: { name: Icon | 'start' | 'pfeil' | 'kaefer' | 'abmelden'; groesse?: number } = $props();
</script>

<svg
	width={groesse}
	height={groesse}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'start'}
		<path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h5v-5h3v5h5V10" />
	{:else if name === 'karte'}
		<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" />
	{:else if name === 'protokoll'}
		<rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.8h6V4" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
	{:else if name === 'personen'}
		<circle cx="9" cy="8" r="3" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14.6c2.4-.3 4.1 1.3 4.6 4.4" />
	{:else if name === 'auto'}
		<path d="M4 16.5V12l2-5h12l2 5v4.5" /><path d="M3 16.5h18" /><circle cx="7.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /><path d="M4.5 12h15" />
	{:else if name === 'boot'}
		<path d="M3 15h18l-2.5 4.5h-13Z" /><path d="M6 15V11h8l3 4" /><path d="M9 11V7.5h3" />
	{:else if name === 'ausweis'}
		<rect x="3.5" y="5.5" width="17" height="13" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 15.8c.5-1.5 1.6-2.3 3-2.3s2.5.8 3 2.3" /><path d="M14.5 10h3.5M14.5 13h3.5" />
	{:else if name === 'aufgaben'}
		<path d="m4.5 6.5 1.5 1.5 3-3" /><path d="m4.5 12.5 1.5 1.5 3-3" /><path d="m4.5 18.5 1.5 1.5 3-3" /><path d="M12 7h7.5M12 13h7.5M12 19h7.5" />
	{:else if name === 'kiste'}
		<path d="M3.5 8 12 4l8.5 4v8.5L12 20.5l-8.5-4Z" /><path d="M3.5 8 12 12l8.5-4M12 12v8.5" />
	{:else if name === 'zahnrad'}
		<circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
	{:else if name === 'anker'}
		<circle cx="12" cy="5" r="2" /><path d="M12 7v14" /><path d="M8.5 10.5h7" /><path d="M4.5 13.5c0 4 3.4 7.5 7.5 7.5s7.5-3.5 7.5-7.5" />
	{:else if name === 'lenkrad'}
		<circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /><path d="M3.8 10.5h6.4M13.8 10.5h6.4M12 14v6.5" />
	{:else if name === 'kaefer'}
		<rect x="7.5" y="8" width="9" height="12" rx="4.5" /><path d="M12 11v9M9 5.5l1.5 2.5M15 5.5 13.5 8M7.5 12H4M20 12h-3.5M7.5 16.5 4.5 18.5M16.5 16.5l3 2M8 9 5 7M16 9l3-2" />
	{:else if name === 'abmelden'}
		<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" />
	{:else if name === 'pfeil'}
		<path d="m14.5 6-6 6 6 6" />
	{/if}
</svg>
