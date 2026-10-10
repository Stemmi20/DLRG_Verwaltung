<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Rahmen from '$lib/components/kfausb/Rahmen.svelte';
	import Antragsdaten from '$lib/components/kfausb/Antragsdaten.svelte';
	import Einheiten from '$lib/components/kfausb/Einheiten.svelte';
	import { ABSCHLUSSPUNKTE, CHECKLISTE, MINDESTALTER, datumDe, type Pruefstufe } from '$lib/kfausb';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const TEXTE: Record<Pruefstufe, { kopf: string; titel: string; ja: string; nein: string; neinFrage: string }> = {
		og: {
			kopf: 'Leiter Einsatz Ortsgruppe',
			titel: 'Antrag befürworten',
			ja: 'Antrag befürworten',
			nein: 'Ablehnen',
			neinFrage: 'Antrag wirklich ablehnen?'
		},
		bezirk: {
			kopf: 'Leitung Einsatz Bezirk',
			titel: 'Ausbildung genehmigen',
			ja: 'Ausbildung genehmigen',
			nein: 'Ablehnen',
			neinFrage: 'Antrag wirklich ablehnen?'
		},
		abschluss: {
			kopf: 'Leitung Einsatz Bezirk',
			titel: 'Ausbildung abnehmen',
			ja: 'Ausbildung abschließen',
			nein: 'Zurück in die Ausbildung',
			neinFrage: 'Ausbildung wirklich zurückgeben?'
		}
	};

	let bemerkung = $state('');
	let hinweisBemerkung = $state(false);
	let senden = $state(false);
	let haken = $state<Record<string, boolean>>({});
	let erteilt = $state<string[]>([]);

	// Nach dem Laden: alle beantragten Fahrzeuge vorauswählen; nach einem Fehlversuch die Haken wiederherstellen.
	$effect(() => {
		if (data.gueltig && erteilt.length === 0) erteilt = [...data.antrag.fahrzeuge];
	});
	$effect(() => {
		const r = form as { checkliste?: Record<string, boolean>; punkte?: Record<string, boolean> } | null;
		const zurueck = r?.checkliste ?? r?.punkte;
		if (zurueck) haken = { ...zurueck };
	});

	const alterOk = $derived(data.gueltig && data.antrag.alter >= MINDESTALTER);
	const darfZustimmen = $derived.by(() => {
		if (!data.gueltig) return false;
		if (data.stufe === 'bezirk') return alterOk && CHECKLISTE.every((p) => haken[p.schluessel]);
		if (data.stufe === 'abschluss') {
			return data.antrag.fortschritt.fertig && erteilt.length > 0 && ABSCHLUSSPUNKTE.every((p) => haken[p.schluessel]);
		}
		return true;
	});

	function ablehnenPruefen(event: MouseEvent, frage: string) {
		if (!bemerkung.trim()) {
			event.preventDefault();
			hinweisBemerkung = true;
			document.getElementById('bemerkung')?.focus();
		} else if (!confirm(frage)) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>Kraftfahrer-Ausbildung – Prüfung</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if form?.erledigt}
	<Rahmen kopf="Kraftfahrer-Ausbildung" titel="Entscheidung gespeichert">
		<p class="hinweis gut"><strong>{form.erledigt}</strong> Der Link ist damit verbraucht – das Fenster kann geschlossen werden.</p>
	</Rahmen>
{:else if !data.gueltig}
	<Rahmen kopf="Kraftfahrer-Ausbildung" titel="Dieser Link ist nicht mehr gültig">
		<p class="hinweis warten">
			Entweder wurde über den Antrag bereits entschieden, der Link ist abgelaufen, oder der
			Antragsteller hat eine neue Erinnerung geschickt – dann gilt nur der Link aus der neuesten Mail.
		</p>
	</Rahmen>
{:else}
	{@const a = data.antrag}
	{@const t = TEXTE[data.stufe]}
	<Rahmen
		kopf={t.kopf}
		titel="{t.titel}: {a.person.vorname} {a.person.name}"
		unterzeile="Antrag eingegangen am {datumDe(a.eingegangenAm)} · Link gültig bis {datumDe(data.gueltigBis)}"
	>
		{#if form?.fehler}<p class="hinweis schlecht">{form.fehler}</p>{/if}

		<div class="karte">
			<h2>Antrag <small>Nachweise öffnen sich in einem neuen Tab.</small></h2>
			<Antragsdaten antrag={a} dokumentLink={(id) => `${page.url.pathname}/dokument/${id}`} />
			{#if a.og}
				<p class="vorher">
					<b>Ortsgruppe:</b> befürwortet am {datumDe(a.og.am)}{a.og.bemerkung ? ` – „${a.og.bemerkung}"` : ''}
				</p>
			{/if}
			{#if a.bezirk}
				<p class="vorher">
					<b>Bezirk:</b> genehmigt am {datumDe(a.bezirk.am)}{a.bezirk.vorlageAm
						? ` · Vorlage am ${datumDe(a.bezirk.vorlageAm)}`
						: ''}{a.bezirk.vorlageBei ? ` bei ${a.bezirk.vorlageBei}` : ''}
				</p>
			{/if}
		</div>

		{#if data.stufe === 'abschluss'}
			<div class="karte">
				<h2>Ausbildungsnachweis <small>{a.fortschritt.ueIst} UE erbracht (Soll mindestens {a.fortschritt.ueSoll} UE)</small></h2>
				<ul class="pruefpunkte">
					<li class:ok={a.fortschritt.einfuehrung}>Erfolgreiche Teilnahme an Einführungsveranstaltung</li>
					<li class:ok={a.fortschritt.sonderrechte}>Erfolgreiche Teilnahme an Schulung Sonder- und Wegerecht</li>
					{#each Object.entries(a.fortschritt.einweisung) as [f, ok] (f)}
						<li class:ok>Erfolgreiche Einweisung auf Fahrzeug {f}</li>
					{/each}
				</ul>
				<Einheiten einheiten={a.fortschritt.einheiten} />
			</div>
		{/if}

		<form
			method="POST"
			action="?/entscheiden"
			class="karte"
			use:enhance={() => {
				senden = true;
				return async ({ update }) => {
					await update({ reset: false });
					senden = false;
				};
			}}
		>
			<h2>Entscheidung</h2>

			{#if data.stufe === 'bezirk'}
				<ul class="haken">
					<li class="auto" class:ok={alterOk}>
						<span>Einsatzkraft mindestens {MINDESTALTER} Jahre alt</span>
						<b>{alterOk ? `Ja · ${a.alter} Jahre` : `Nein · ${a.alter} Jahre`}</b>
					</li>
					{#each CHECKLISTE as p (p.schluessel)}
						<li>
							<label>
								<input type="checkbox" name={p.schluessel} value="ja" bind:checked={haken[p.schluessel]} />
								<span>{p.text}</span>
							</label>
						</li>
					{/each}
				</ul>
				<div class="raster">
					<label class="feld">Vorlage am <span class="optional">optional</span><input type="date" name="vorlageAm" /></label>
					<label class="feld">Vorlage bei <span class="optional">optional</span><input name="vorlageBei" /></label>
				</div>
			{:else if data.stufe === 'abschluss'}
				<p class="unterzeile">Fahrberechtigung erteilt für:</p>
				<div class="chips">
					{#each a.fahrzeuge as f (f)}
						<label class="chip" class:aktiv={erteilt.includes(f)}>
							<input type="checkbox" name="fahrzeug" value={f} bind:group={erteilt} />
							{f}
						</label>
					{/each}
				</div>
				<ul class="haken">
					{#each ABSCHLUSSPUNKTE as p (p.schluessel)}
						<li>
							<label>
								<input type="checkbox" name={p.schluessel} value="ja" bind:checked={haken[p.schluessel]} />
								<span>{p.text}</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<label class="feld ganz">
				Bemerkung
				<span class="optional">
					{data.stufe === 'abschluss' ? 'Pflicht beim Zurückgeben – was fehlt noch?' : 'Pflicht beim Ablehnen'}
				</span>
				<textarea id="bemerkung" name="bemerkung" bind:value={bemerkung} aria-invalid={hinweisBemerkung && !bemerkung.trim()}></textarea>
				{#if hinweisBemerkung && !bemerkung.trim()}<em>Bitte kurz begründen.</em>{/if}
			</label>

			<div class="knoepfe">
				<button class="knopf rot" name="entscheidung" value="ja" disabled={senden || !darfZustimmen}>{t.ja}</button>
				<button class="knopf" name="entscheidung" value="nein" disabled={senden} onclick={(e) => ablehnenPruefen(e, t.neinFrage)}>
					{t.nein}
				</button>
				{#if !darfZustimmen && data.stufe !== 'og'}
					<small>Zum {data.stufe === 'bezirk' ? 'Genehmigen' : 'Abschließen'} müssen alle Punkte erfüllt sein.</small>
				{/if}
			</div>
		</form>
	</Rahmen>
{/if}

<style>
	.vorher {
		margin: 12px 0 0;
		padding: 9px 12px;
		border-radius: 8px;
		background: #f5f5f3;
	}
	.optional {
		margin-left: 4px;
		color: #999;
		font-weight: 400;
	}
	.unterzeile {
		margin: 0 0 8px;
		font-weight: 700;
	}
	.haken,
	.pruefpunkte {
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
		border: 1px solid #e5e5e3;
		border-radius: 9px;
	}
	.haken li,
	.pruefpunkte li {
		padding: 11px 14px;
		border-bottom: 1px solid #ececea;
	}
	.haken li:last-child,
	.pruefpunkte li:last-child {
		border-bottom: 0;
	}
	.haken label {
		display: flex;
		align-items: center;
		gap: 11px;
		cursor: pointer;
		font-size: 14px;
	}
	.haken input {
		width: 19px;
		height: 19px;
		flex: none;
		accent-color: #16855b;
	}
	.haken li.auto {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		background: #fff6f6;
		font-size: 14px;
	}
	.haken li.auto b {
		color: #c8000d;
	}
	.haken li.auto.ok {
		background: #f4faf7;
	}
	.haken li.auto.ok b {
		color: #16855b;
	}
	.pruefpunkte li {
		padding-left: 40px;
		position: relative;
		color: #c8000d;
	}
	.pruefpunkte li::before {
		content: '✕';
		position: absolute;
		left: 15px;
		font-weight: 700;
	}
	.pruefpunkte li.ok {
		color: #16855b;
	}
	.pruefpunkte li.ok::before {
		content: '✓';
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		margin-bottom: 16px;
	}
	.chip {
		position: relative;
		padding: 10px 17px;
		border: 1px solid #d3d3d0;
		border-radius: 30px;
		font-weight: 700;
		cursor: pointer;
	}
	.chip input {
		position: absolute;
		opacity: 0;
	}
	.chip.aktiv {
		border-color: #16855b;
		background: #16855b;
		color: #fff;
	}
	.chip:focus-within {
		outline: 2px solid #575756;
		outline-offset: 2px;
	}
	.raster {
		margin-bottom: 14px;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 16px;
	}
	.knoepfe small {
		color: #888;
	}
</style>
