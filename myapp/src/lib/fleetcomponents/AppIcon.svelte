<script lang="ts">
	let { name, size = 24 }: { name: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'map'}<path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2Z" /><path d="M8 4v13M16 7v13" />
	{:else if name === 'vehicle'}<path d="M4 16V9l2-4h11l3 4v7" /><path d="M4 11h16M7 16h10" /><circle
			cx="7"
			cy="17"
			r="2"
		/><circle cx="17" cy="17" r="2" />
	{:else if name === 'status'}<circle cx="12" cy="12" r="9" /><path d="M8 12h2l1.5-4 2 8 1.5-4h2" />
	{:else if name === 'route'}<circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path
			d="M7.5 16.5c3-2 1-5 4-6s3-2 5-3"
		/>
	{:else if name === 'location'}<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle
			cx="12"
			cy="10"
			r="2.5"
		/>
	{:else if name === 'crew'}<circle cx="9" cy="8" r="3" /><path
			d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5a3 3 0 0 1 0 6M17 13c2.6.4 4 2.8 4 6"
		/>
	{:else if name === 'home'}<path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" />
	{:else if name === 'logout'}<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
	{:else if name === 'list'}<path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" /><circle
			cx="4"
			cy="12"
			r="1"
		/><circle cx="4" cy="18" r="1" />
	{:else if name === 'calendar'}<rect x="3" y="5" width="18" height="16" rx="2" /><path
			d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"
		/>
	{:else}<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />{/if}
</svg>
