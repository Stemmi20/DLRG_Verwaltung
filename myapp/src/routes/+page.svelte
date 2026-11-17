<script lang="ts">
	import { MENUE, type Bereich } from '$lib/navigation';

	/*
	 * Die Kacheln kommen aus $lib/navigation.ts – dieselbe Liste wie die
	 * Navigationsleiste links. Die Farbklassen stehen hier ausgeschrieben,
	 * damit UnoCSS sie findet.
	 */
	const KOPF: Record<Bereich['farbe'], string> = {
		rot: 'bg-lvs-rot',
		blau: 'bg-lvs-wasser',
		gruen: 'bg-green-7',
	};
	const KACHEL: Record<Bereich['farbe'], string> = {
		rot: 'bg-red-9',
		blau: 'bg-blue-9',
		gruen: 'bg-green-9',
	};
</script>

<div class="min-h-dvh bg-lvs-nacht text-lvs-eis font-body p-4 lg:p-8">
	<div class="max-w-4xl mx-auto grid gap-6">
		{#each MENUE as bereich (bereich.titel)}
			<div class="lvs-panel p-4 grid gap-3 {KOPF[bereich.farbe]}">
				<span class="font-display text-2xl font-600 uppercase block flex justify-center">{bereich.titel}</span>
			</div>
			<nav class="grid gap-3 sm:grid-cols-2" aria-label={bereich.titel}>
				{#each bereich.punkte as p (p.titel)}
					{#if p.href}
						<a
							href={p.href}
							class="lvs-panel p-4 no-underline text-lvs-eis hover:border-lvs-wasser transition-colors {KACHEL[bereich.farbe]}"
						>
							<span class="font-display text-2xl font-600 uppercase block">{p.titel}</span>
							<span class="text-sm text-lvs-grau">{p.beschreibung}</span>
						</a>
					{:else}
						<span class="lvs-panel p-4 text-lvs-eis disabled bg-dark" aria-disabled="true">
							<span class="font-display text-2xl font-600 uppercase block">{p.titel}</span>
							<span class="text-sm text-lvs-grau">Kommt noch</span>
						</span>
					{/if}
				{/each}
			</nav>
		{/each}
	</div>
</div>

<style>

	.disabled {
		cursor: not-allowed;
		color: #ccc;
	}
	
	@keyframes puls {
		0%,
		100% {
			background-color: #e30613;
		}
		50% {
			background-color: #b8050f;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		
	}
</style>
