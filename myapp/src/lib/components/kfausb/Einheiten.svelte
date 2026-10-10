<script lang="ts">
	import type { Snippet } from 'svelte';
	import { datumDe, type EinheitMitNachweis } from '$lib/kfausb';

	/*
	 * Der Ausbildungsnachweis (Seite 3 des Papierformulars), gruppiert wie dort.
	 * `aktion` hängt pro Zeile Bedienelemente an – auf der Ausbilderseite das
	 * Abzeichnen, bei Antragsteller und Prüfer bleibt es leer.
	 */
	let {
		einheiten,
		aktion
	}: { einheiten: EinheitMitNachweis[]; aktion?: Snippet<[EinheitMitNachweis]> } = $props();

	const gruppen = $derived.by(() => {
		const liste: { titel: string; einheiten: EinheitMitNachweis[] }[] = [
			{ titel: 'Einführungsveranstaltung', einheiten: einheiten.filter((e) => e.gruppe === 'einfuehrung') },
			{ titel: 'Sonder- und Wegerecht', einheiten: einheiten.filter((e) => e.gruppe === 'sonderrechte') }
		];
		const fahrzeuge = [...new Set(einheiten.map((e) => e.fahrzeug).filter(Boolean))];
		for (const f of fahrzeuge) {
			liste.push({ titel: `Fahrzeug ${f}`, einheiten: einheiten.filter((e) => e.fahrzeug === f) });
		}
		return liste.filter((g) => g.einheiten.length > 0);
	});
</script>

<div class="einheiten">
	{#each gruppen as gruppe (gruppe.titel)}
		{@const erledigt = gruppe.einheiten.filter((e) => e.nachweis).length}
		<section>
			<h3>
				<span>{gruppe.titel}</span>
				<b class:fertig={erledigt === gruppe.einheiten.length}>
					{erledigt}/{gruppe.einheiten.length}
				</b>
			</h3>
			<ul>
				{#each gruppe.einheiten as e (e.id)}
					<li class:erledigt={e.nachweis}>
						<i aria-hidden="true">{e.nachweis ? '✓' : ''}</i>
						<div class="inhalt">
							<strong>{e.titel}</strong>
							{#if e.details}
								<small>{e.details.join(' · ')}</small>
							{/if}
							{#if e.nachweis}
								<span class="stand">
									{datumDe(e.nachweis.datum)} · {e.nachweis.ue} UE · {e.nachweis.ausbilderName}
								</span>
							{:else}
								<span class="stand offen">offen · mindestens {e.ue} UE</span>
							{/if}
						</div>
						{#if aktion}
							<div class="aktion">{@render aktion(e)}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.einheiten {
		display: grid;
		gap: 16px;
	}
	h3 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 0 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}
	h3 b {
		padding: 3px 9px;
		border-radius: 20px;
		background: #f0f0ee;
		font-size: 11px;
		letter-spacing: 0;
	}
	h3 b.fertig {
		background: #e8f6f0;
		color: #16855b;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid #e5e5e3;
		border-radius: 9px;
		overflow: hidden;
	}
	li {
		display: grid;
		grid-template-columns: 26px minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
		padding: 11px 14px;
		border-bottom: 1px solid #ececea;
	}
	li:last-child {
		border-bottom: 0;
	}
	li.erledigt {
		background: #fbfdfc;
	}
	li > i {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 2px solid #d3d3d0;
		border-radius: 50%;
		color: #fff;
		font-size: 12px;
		font-style: normal;
		font-weight: 700;
	}
	li.erledigt > i {
		border-color: #16855b;
		background: #16855b;
	}
	.inhalt strong,
	.inhalt small,
	.inhalt .stand {
		display: block;
	}
	.inhalt small {
		margin-top: 2px;
		color: #888;
		font-size: 11px;
	}
	.stand {
		margin-top: 3px;
		color: #16855b;
		font-size: 11px;
		font-weight: 700;
	}
	.stand.offen {
		color: #999;
		font-weight: 400;
	}
	@media (max-width: 700px) {
		li {
			grid-template-columns: 26px minmax(0, 1fr);
		}
		.aktion {
			grid-column: 2;
		}
	}
</style>
