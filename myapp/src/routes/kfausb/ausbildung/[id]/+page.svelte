<script lang="ts">
	import { enhance } from '$app/forms';
	import Rahmen from '$lib/components/kfausb/Rahmen.svelte';
	import Einheiten from '$lib/components/kfausb/Einheiten.svelte';
	import { STATUS_TEXT, datumDe, heuteISO } from '$lib/kfausb';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const heute = heuteISO();
	const a = $derived(data.antrag);
	const offen = $derived(a.status === 'in_ausbildung');
	let arbeitet = $state<string | null>(null);

	const rueckgabe = $derived(
		a.status === 'in_ausbildung'
			? a.verlauf.find((v) => v.text.startsWith('Zurück in die Ausbildung'))
			: undefined
	);

	/** Formular pro Zeile – nur diese Zeile zeigt „speichert …". */
	function senden(einheit: string): SubmitFunction {
		return () => {
			arbeitet = einheit;
			return async ({ update }) => {
				await update();
				arbeitet = null;
			};
		};
	}
</script>

<svelte:head><title>Ausbildung {a.person.vorname} {a.person.name}</title></svelte:head>

<Rahmen
	kopf="Kraftfahrer-Ausbildung · Ausbildungsnachweis"
	titel="{a.person.vorname} {a.person.name}"
	unterzeile="{a.person.einsatzgruppe} · Führerschein {a.klassen.map((k) => k.klasse).join(', ')} · Einweisung auf {a.fahrzeuge.join(', ')}"
>
	<a class="zurueck" href="/kfausb">← Zur Übersicht</a>

	{#if form?.abnahme}
		<p class="hinweis gut">
			<strong>Alle Einheiten sind abgezeichnet.</strong>
			Die Leitung Einsatz im Bezirk hat die Anfrage zur Abnahme per Mail bekommen.
		</p>
	{/if}
	{#if form?.fehler}<p class="hinweis schlecht">{form.fehler}</p>{/if}

	{#if a.status === 'ausbildung_fertig'}
		<p class="hinweis warten">
			<strong>{STATUS_TEXT[a.status]}.</strong> Die Einträge sind gesperrt, bis der Bezirk entschieden hat.
		</p>
	{:else if a.status === 'abgeschlossen'}
		<p class="hinweis gut"><strong>Ausbildung abgeschlossen.</strong></p>
	{/if}

	{#if rueckgabe}
		<p class="hinweis warten">
			<strong>Vom Bezirk zurückgegeben am {datumDe(rueckgabe.am)}:</strong>
			{rueckgabe.text.replace('Zurück in die Ausbildung: ', '')}
		</p>
	{/if}

	<div class="karte">
		<h2>
			Einheiten
			<small>
				{a.fortschritt.erledigt} von {a.fortschritt.gesamt} abgezeichnet · {a.fortschritt.ueIst} UE erbracht,
				noch mindestens {a.fortschritt.ueOffen} UE offen
			</small>
		</h2>

		{#if offen && a.fortschritt.fertig}
			<form method="POST" action="?/abnahme" use:enhance class="abnahme">
				<span>Alle Einheiten sind abgezeichnet. Nach der Nachschulung kannst du die Ausbildung erneut zur Abnahme melden.</span>
				<button class="knopf rot">Zur Abnahme melden</button>
			</form>
		{/if}

		<Einheiten einheiten={a.fortschritt.einheiten}>
			{#snippet aktion(e)}
				{#if offen && !e.nachweis}
					<form method="POST" action="?/eintragen" class="abzeichnen" use:enhance={senden(e.id)}>
						<input type="hidden" name="einheit" value={e.id} />
						<label>
							<span class="versteckt">Datum</span>
							<input type="date" name="datum" value={heute} max={heute} required />
						</label>
						<label class="ue">
							<input type="number" name="ue" value={e.ue} min={e.ue} max="20" step="1" required />
							<span>UE</span>
						</label>
						<button class="knopf rot" disabled={arbeitet === e.id}>
							{arbeitet === e.id ? '…' : 'Abzeichnen'}
						</button>
					</form>
					{#if form?.einheit === e.id && form?.fehler}<em class="fehlertext">{form.fehler}</em>{/if}
				{:else if offen && e.nachweis?.ausbilderId === data.ichId}
					<form method="POST" action="?/entfernen" use:enhance={senden(e.id)}>
						<input type="hidden" name="einheit" value={e.id} />
						<button class="knopf leise" disabled={arbeitet === e.id}>Zurücknehmen</button>
					</form>
				{/if}
			{/snippet}
		</Einheiten>
		<p class="fussnote">
			Die UE beim Fahren können sich erhöhen, wenn das sichere Beherrschen des Fahrzeuges mehr Zeit
			braucht – trag dann die tatsächlich geleisteten UE ein.
		</p>
	</div>
</Rahmen>

<style>
	.zurueck {
		display: inline-block;
		margin: -6px 0 16px;
		color: #e30613;
		font-weight: 700;
		text-decoration: none;
	}
	.abzeichnen {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.abzeichnen input {
		height: 38px;
		padding: 0 9px;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
		font: inherit;
	}
	.ue {
		display: flex;
		align-items: center;
		gap: 5px;
		color: #888;
	}
	.ue input {
		width: 58px;
	}
	.abzeichnen .knopf {
		min-height: 38px;
		padding: 0 14px;
	}
	.versteckt {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.abnahme {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 16px;
		padding: 12px 14px;
		border-radius: 9px;
		background: #e8f6f0;
	}
	.fussnote {
		margin: 14px 0 0;
		color: #888;
		font-size: 11px;
	}
	@media (max-width: 700px) {
		.abzeichnen {
			flex-wrap: wrap;
		}
		.abnahme {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
