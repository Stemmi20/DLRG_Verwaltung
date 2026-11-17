<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ANZAHL_MAX,
		NAME_MAX,
		NOTIZ_MAX,
		STANDORTE,
		ZUSTAENDE,
		ZUSTAND_KURZ,
		ZUSTAND_TEXT,
		nichtBereit,
		zeitDe,
		type MaterialAnsicht,
		type Zustand,
	} from '$lib/material';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Die Aktionen liefern verschiedene Formen – hier eine gemeinsame Sicht. */
	const antwort = $derived(
		form as {
			ok?: boolean;
			fehler?: string;
			id?: string | null;
			neu?: boolean;
			bearbeitet?: boolean;
			werte?: { name: string; nummer: string; kategorie: string; standort: string; anzahl: number };
		} | null,
	);

	// ─── Filter ───
	let suche = $state('');
	let standort = $state<string>('alle');
	let nurProbleme = $state(false);

	const gefiltert = $derived.by(() => {
		const s = suche.trim().toLowerCase();
		return data.eintraege.filter(
			(m) =>
				(standort === 'alle' || m.standort === standort) &&
				(!nurProbleme || nichtBereit(m.bestand) > 0) &&
				(!s || `${m.name} ${m.nummer} ${m.kategorie} ${m.notiz}`.toLowerCase().includes(s)),
		);
	});

	/** Nach Standort gruppiert, in der Reihenfolge der Liste. */
	const gruppen = $derived.by(() => {
		const g = new Map<string, MaterialAnsicht[]>();
		for (const m of gefiltert) g.set(m.standort, [...(g.get(m.standort) ?? []), m]);
		return [...g];
	});

	/**
	 * Alle Orte für die Liste links: die festen aus STANDORTE, dazu welche, die
	 * nur noch in alten Einträgen stehen (z. B. nach Umbenennung).
	 */
	const orte = $derived.by(() => {
		const namen = [...STANDORTE] as string[];
		for (const m of data.eintraege) if (!namen.includes(m.standort)) namen.push(m.standort);
		return namen.map((name) => {
			const hier = data.eintraege.filter((m) => m.standort === name);
			return { name, ...standortZahlen(hier) };
		});
	});
	const gesamt = $derived(standortZahlen(data.eintraege));

	/** Kopfzahlen für den gewählten Ort (oder alles). */
	const summe = $derived.by(() => {
		const s = { TROCKEN: 0, DEFEKT: 0, SONSTIGES: 0, eintraege: 0 };
		for (const m of data.eintraege) {
			if (standort !== 'alle' && m.standort !== standort) continue;
			s.TROCKEN += m.bestand.TROCKEN;
			s.DEFEKT += m.bestand.DEFEKT;
			s.SONSTIGES += m.bestand.SONSTIGES;
			if (nichtBereit(m.bestand)) s.eintraege++;
		}
		return s;
	});

	function standortZahlen(liste: MaterialAnsicht[]) {
		return { teile: liste.reduce((n, m) => n + m.anzahl, 0), weg: liste.reduce((n, m) => n + nichtBereit(m.bestand), 0) };
	}

	// ─── Offene Formulare ───
	let offen = $state<{ id: string; art: 'zustand' | 'bearbeiten' } | null>(null);
	let neuOffen = $state(false);
	let arbeitet = $state<string | null>(null);

	$effect(() => {
		if (antwort?.neu && antwort.fehler) neuOffen = true;
	});

	function umschalten(id: string, art: 'zustand' | 'bearbeiten') {
		offen = offen?.id === id && offen.art === art ? null : { id, art };
	}

	function senden(schluessel: string, frage?: string): SubmitFunction {
		return ({ cancel }) => {
			if (frage && !confirm(frage)) return cancel();
			arbeitet = schluessel;
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') {
					if (schluessel === 'neu') neuOffen = false;
					else offen = null;
				}
				arbeitet = null;
			};
		};
	}

	/** Bei einem Einzelstück gibt es genau einen Zustand mit 1. */
	function aktuellerZustand(m: MaterialAnsicht): Zustand {
		return ZUSTAENDE.find((z) => m.bestand[z] > 0) ?? 'BEREIT';
	}
</script>

<svelte:head><title>Einsatzmaterial</title></svelte:head>

{#snippet stammFelder(w: { name: string; nummer: string; kategorie: string; standort: string; anzahl: number } | null)}
	<label class="breit">
		<span>Bezeichnung</span>
		<input name="name" required maxlength={NAME_MAX} value={w?.name ?? ''} placeholder="z. B. Neoprenanzug Gr. L" />
	</label>
	<label>
		<span>Nummer <small>optional</small></span>
		<input name="nummer" maxlength="30" value={w?.nummer ?? ''} placeholder="z. B. #07" />
	</label>
	<label>
		<span>Kategorie <small>optional</small></span>
		<input name="kategorie" maxlength="40" list="kategorien" value={w?.kategorie ?? ''} placeholder="z. B. Schwimmer" />
	</label>
	<label>
		<span>Standort</span>
		<select name="standort" required value={w?.standort ?? ''}>
			<option value="" disabled>Bitte auswählen …</option>
			{#each STANDORTE as s (s)}<option value={s}>{s}</option>{/each}
		</select>
	</label>
	<label>
		<span>Anzahl</span>
		<input name="anzahl" type="number" required min="1" max={ANZAHL_MAX} step="1" value={w?.anzahl ?? 1} />
	</label>
{/snippet}

<datalist id="kategorien">
	{#each data.kategorien as k (k)}<option value={k}></option>{/each}
</datalist>

<div class="seite">
	<div class="inhalt">
		<header class="kopf">
			<div>
				<p class="ueber">Ortsgruppe {data.ortsgruppe || '–'}</p>
				<h1>Einsatzmaterial</h1>
			</div>
			{#if data.istAdmin}
				<button class="knopf rot" onclick={() => (neuOffen = !neuOffen)} aria-expanded={neuOffen}>
					{neuOffen ? 'Schließen' : '+ Material'}
				</button>
			{/if}
		</header>

		<nav class="orte" aria-label="Orte">
			<button class="ort" class:aktiv={standort === 'alle'} aria-current={standort === 'alle'} onclick={() => (standort = 'alle')}>
				<span class="ort-name">Alle Orte</span>
				<span class="ort-zahl">{gesamt.teile}</span>
				{#if gesamt.weg}<b class="ort-weg" title="nicht einsatzbereit">{gesamt.weg}</b>{/if}
			</button>
			{#each orte as o (o.name)}
				<button
					class="ort"
					class:aktiv={standort === o.name}
					class:leer-ort={!o.teile}
					aria-current={standort === o.name}
					onclick={() => (standort = o.name)}
				>
					<span class="ort-name">{o.name}</span>
					<span class="ort-zahl">{o.teile || '–'}</span>
					{#if o.weg}<b class="ort-weg" title="nicht einsatzbereit">{o.weg}</b>{/if}
				</button>
			{/each}
		</nav>

		<div class="haupt">
		{#if neuOffen && data.istAdmin}
			<form method="POST" action="?/anlegen" class="panel formular" use:enhance={senden('neu')}>
				<h2>Neues Material</h2>
				<div class="raster">{@render stammFelder(
					antwort?.neu && antwort.fehler
						? (antwort.werte ?? null)
						: { name: '', nummer: '', kategorie: '', standort: standort === 'alle' ? '' : standort, anzahl: 1 },
				)}</div>
				<p class="tipp">Einzelstück = Anzahl 1, gern mit Nummer. Bei Anzahl über 1 wird nur gezählt, wie viele wo sind.</p>
				{#if antwort?.neu && antwort.fehler}<p class="fehlertext">{antwort.fehler}</p>{/if}
				<div class="leiste">
					<button class="knopf rot" disabled={arbeitet === 'neu'}>{arbeitet === 'neu' ? 'Speichert …' : 'Anlegen'}</button>
				</div>
			</form>
		{/if}

		<section class="kacheln" aria-label="Nicht einsatzbereit">
			{#each ['TROCKEN', 'DEFEKT', 'SONSTIGES'] as const as z (z)}
				<div class="kachel z-{z.toLowerCase()}">
					<span class="beschriftung">{ZUSTAND_TEXT[z]}</span>
					<strong class="zahl">{summe[z]}</strong>
				</div>
			{/each}
		</section>

		<div class="filter">
			<input type="search" bind:value={suche} placeholder="Suchen: Bezeichnung, Nummer, Notiz …" aria-label="Suchen" />
			<label class="schalter">
				<input type="checkbox" bind:checked={nurProbleme} />
				<span>Nur nicht einsatzbereit{summe.eintraege ? ` (${summe.eintraege})` : ''}</span>
			</label>
		</div>

		{#each gruppen as [ort, liste] (ort)}
			{@const z = standortZahlen(liste)}
			<section class="gruppe">
				<h2 class="gruppe-kopf">
					<span>{ort}</span>
					<small><span>{z.teile} {z.teile === 1 ? 'Teil' : 'Teile'}</span>{#if z.weg}<b class="fehlt">{z.weg} nicht einsatzbereit</b>{:else}<span>alles da</span>{/if}</small>
				</h2>

				<ul class="liste">
					{#each liste as m (m.id)}
						{@const weg = nichtBereit(m.bestand)}
						{@const einzeln = m.anzahl === 1}
						<li class="eintrag" class:problem={weg > 0}>
							<div class="zeile">
								<div class="titel">
									<strong>{m.name}</strong>
									{#if m.nummer}<span class="nummer">{m.nummer}</span>{/if}
									{#if m.kategorie}<span class="kategorie">{m.kategorie}</span>{/if}
								</div>
								<div class="chips">
									{#if einzeln}
										{@const z1 = aktuellerZustand(m)}
										<span class="chip z-{z1.toLowerCase()}">{ZUSTAND_TEXT[z1]}</span>
									{:else}
										<span class="chip z-bereit" title="einsatzbereit von insgesamt">{m.bestand.BEREIT}/{m.anzahl} bereit</span>
										{#each ['TROCKEN', 'DEFEKT', 'SONSTIGES'] as const as zz (zz)}
											{#if m.bestand[zz]}<span class="chip z-{zz.toLowerCase()}">{m.bestand[zz]} {ZUSTAND_KURZ[zz]}</span>{/if}
										{/each}
									{/if}
								</div>
							</div>

							{#if m.notiz && weg}<p class="notiz">{m.notiz}</p>{/if}

							{#if antwort?.id === m.id && antwort.fehler}<p class="fehlertext">{antwort.fehler}</p>{/if}

							<div class="aktionen">
								<button class="knopf klein" onclick={() => umschalten(m.id, 'zustand')} aria-expanded={offen?.id === m.id && offen.art === 'zustand'}>
									Zustand ändern
								</button>
								{#if data.istAdmin}
									<button class="knopf klein leise" onclick={() => umschalten(m.id, 'bearbeiten')}>Bearbeiten</button>
								{/if}
								{#if m.verlauf.length}
									<details class="verlauf">
										<summary>Verlauf</summary>
										<ol>
											{#each m.verlauf as v, i (i)}<li><time>{zeitDe(v.am)}</time> {v.text}</li>{/each}
										</ol>
									</details>
								{/if}
							</div>

							{#if offen?.id === m.id && offen.art === 'zustand'}
								<form method="POST" action="?/zustand" class="unterformular" use:enhance={senden(`z${m.id}`)}>
									<input type="hidden" name="id" value={m.id} />
									{#if einzeln}
										<input type="hidden" name="von" value={aktuellerZustand(m)} />
										<input type="hidden" name="anzahl" value="1" />
										<label>
											<span>Neuer Zustand</span>
											<select name="nach" required>
												{#each ZUSTAENDE.filter((x) => x !== aktuellerZustand(m)) as x (x)}
													<option value={x}>{ZUSTAND_TEXT[x]}</option>
												{/each}
											</select>
										</label>
									{:else}
										<label class="schmal">
											<span>Anzahl</span>
											<input name="anzahl" type="number" min="1" max={m.anzahl} value="1" required />
										</label>
										<label>
											<span>von</span>
											<select name="von" required>
												{#each ZUSTAENDE.filter((x) => m.bestand[x] > 0) as x (x)}
													<option value={x}>{ZUSTAND_TEXT[x]} ({m.bestand[x]})</option>
												{/each}
											</select>
										</label>
										<label>
											<span>nach</span>
											<select name="nach" required value={m.bestand.BEREIT > 0 ? 'TROCKEN' : 'BEREIT'}>
												{#each ZUSTAENDE as x (x)}<option value={x}>{ZUSTAND_TEXT[x]}</option>{/each}
											</select>
										</label>
									{/if}
									<label class="breit">
										<span>Notiz <small>Pflicht bei „Beschädigt" und „Sonstiges"</small></span>
										<input name="notiz" maxlength={NOTIZ_MAX} placeholder="z. B. Reißverschluss kaputt, bei Max zum Nähen" />
									</label>
									<button class="knopf rot" disabled={arbeitet === `z${m.id}`}>{arbeitet === `z${m.id}` ? '…' : 'Speichern'}</button>
								</form>
							{/if}

							{#if offen?.id === m.id && offen.art === 'bearbeiten' && data.istAdmin}
								<form method="POST" action="?/bearbeiten" class="unterformular raster" use:enhance={senden(`b${m.id}`)}>
									<input type="hidden" name="id" value={m.id} />
									<input type="hidden" name="stand" value={m.geaendertAm} />
									{@render stammFelder(m)}
									<div class="leiste breit">
										<button class="knopf rot" disabled={arbeitet === `b${m.id}`}>{arbeitet === `b${m.id}` ? '…' : 'Speichern'}</button>
									</div>
								</form>
								<form method="POST" action="?/loeschen" use:enhance={senden(`l${m.id}`, `„${m.name}${m.nummer ? ` ${m.nummer}` : ''}" wirklich löschen?`)}>
									<input type="hidden" name="id" value={m.id} />
									<button class="knopf klein loeschen">Material löschen</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="leer">
				{#if standort !== 'alle' && !data.eintraege.some((m) => m.standort === standort)}
					Auf {standort} ist noch kein Material erfasst.
				{:else if data.eintraege.length}
					Nichts gefunden – Filter anpassen.
				{:else if data.istAdmin}
					Noch kein Material erfasst. Leg mit „+ Material" das erste an.
				{:else}
					Noch kein Material erfasst.
				{/if}
			</p>
		{/each}
		</div>
	</div>
</div>

<style>
	.seite {
		--nacht: #0b1014;
		--stahl: #16202a;
		--kante: #243342;
		--eis: #e6edf2;
		--grau: #8a9aa8;
		--rot: #e30613;
		--gelb: #ffdd00;
		--wasser: #0090d4;
		--gruen: #35b27a;
		--orange: #ff8a3d;
		--lila: #b48cff;

		color-scheme: dark;
		min-height: calc(100dvh - var(--navbar-hoehe, 0px));
		padding: 28px 16px 56px;
		background: var(--nacht);
		color: var(--eis);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
	}
	.seite :global(*) {
		box-sizing: border-box;
	}
	.inhalt {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		grid-template-areas: 'kopf kopf' 'orte haupt';
		gap: 18px 24px;
		align-items: start;
		max-width: 76rem;
		margin: 0 auto;
	}
	.kopf {
		grid-area: kopf;
	}
	.haupt {
		grid-area: haupt;
		display: grid;
		gap: 18px;
		min-width: 0;
	}

	/* ─── Orte links ─── */
	.orte {
		grid-area: orte;
		position: sticky;
		top: calc(var(--navbar-hoehe, 0px) + 16px);
		display: grid;
		gap: 2px;
		max-height: calc(100dvh - var(--navbar-hoehe, 0px) - 32px);
		padding: 6px;
		border: 1px solid var(--kante);
		border-radius: 12px;
		background: var(--stahl);
		overflow-y: auto;
	}
	.ort {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 42px;
		padding: 0 12px;
		border: 0;
		border-left: 3px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--eis);
		font: inherit;
		font-size: 15px;
		text-align: left;
		cursor: pointer;
	}
	.ort:hover {
		background: var(--kante);
	}
	.ort:focus-visible {
		outline: 3px solid var(--wasser);
		outline-offset: -3px;
	}
	.ort.aktiv {
		border-left-color: var(--gelb);
		background: var(--kante);
		font-weight: 600;
	}
	.ort:first-child {
		margin-bottom: 4px;
	}
	.ort-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.leer-ort .ort-name {
		color: var(--grau);
	}
	.ort-zahl {
		color: var(--grau);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.ort-weg {
		min-width: 22px;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--rot);
		color: #fff;
		font-size: 12px;
		text-align: center;
	}
	h1,
	h2,
	.beschriftung,
	.knopf,
	.chip {
		font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
	}

	/* ─── Kopf ─── */
	.kopf {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
	}
	.ueber {
		margin: 0 0 4px;
		color: var(--grau);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	h1 {
		margin: 0;
		font-size: 38px;
		font-weight: 700;
		line-height: 1;
		text-transform: uppercase;
	}

	/* ─── Bausteine ─── */
	.panel {
		padding: 18px 20px;
		border: 1px solid var(--kante);
		border-radius: 12px;
		background: var(--stahl);
	}
	.knopf {
		min-height: 44px;
		padding: 0 18px;
		border: 1px solid var(--kante);
		border-radius: 8px;
		background: transparent;
		color: var(--eis);
		font-size: 17px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.knopf.klein {
		min-height: 36px;
		padding: 0 12px;
		font-size: 15px;
	}
	.knopf:hover:not(:disabled) {
		border-color: var(--grau);
	}
	.knopf:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--wasser);
		outline-offset: 2px;
	}
	.knopf.rot {
		border-color: var(--rot);
		background: var(--rot);
	}
	.knopf.rot:hover:not(:disabled) {
		background: #c4000f;
	}
	.knopf.leise {
		color: var(--grau);
	}
	.knopf.loeschen {
		margin-top: 8px;
		border-color: transparent;
		color: #ff6b73;
	}
	.knopf:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.fehlertext {
		margin: 0;
		color: #ff6b73;
		font-size: 14px;
	}
	input,
	select {
		width: 100%;
		min-height: 42px;
		padding: 0 12px;
		border: 1px solid var(--kante);
		border-radius: 8px;
		background: var(--nacht);
		color: var(--eis);
		font: inherit;
		font-size: 16px;
	}
	label span {
		display: block;
		margin-bottom: 5px;
		color: var(--grau);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	label small {
		text-transform: none;
		letter-spacing: 0;
		opacity: 0.8;
	}

	/* ─── Formulare ─── */
	.formular {
		display: grid;
		gap: 14px;
	}
	.formular h2 {
		margin: 0;
		font-size: 22px;
		text-transform: uppercase;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}
	.raster .breit {
		grid-column: 1 / -1;
	}
	.tipp {
		margin: 0;
		color: var(--grau);
		font-size: 13px;
	}
	.leiste {
		display: flex;
		justify-content: flex-end;
	}

	/* ─── Kacheln ─── */
	.kacheln {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.kachel {
		--farbe: var(--grau);
		display: grid;
		gap: 2px;
		padding: 14px 18px;
		border: 1px solid var(--kante);
		border-top: 4px solid var(--farbe);
		border-radius: 12px;
		background: var(--stahl);
	}
	.beschriftung {
		color: var(--grau);
		font-size: 15px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.zahl {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 38px;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.05;
	}

	/* Farben je Zustand – gleiche Farbe in Kachel, Chip und Rand. */
	.z-bereit {
		--farbe: var(--gruen);
	}
	.z-trocken {
		--farbe: var(--orange);
	}
	.z-defekt {
		--farbe: var(--rot);
	}
	.z-sonstiges {
		--farbe: var(--lila);
	}

	/* ─── Filter ─── */
	.filter {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
	}
	.schalter {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		cursor: pointer;
	}
	.schalter input {
		width: 18px;
		min-height: 18px;
		accent-color: var(--rot);
	}
	.schalter span {
		margin: 0;
		color: var(--eis);
		font-size: 14px;
		text-transform: none;
		letter-spacing: 0;
	}

	/* ─── Gruppen ─── */
	.gruppe {
		display: grid;
		gap: 8px;
	}
	.gruppe-kopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 8px 0 0;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--gelb);
		font-size: 24px;
		text-transform: uppercase;
	}
	.gruppe-kopf small {
		display: flex;
		gap: 8px;
		align-items: baseline;
		color: var(--grau);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		font-size: 13px;
		text-transform: none;
	}
	.fehlt {
		padding: 1px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--rot) 22%, transparent);
		color: #ff8a90;
		font-weight: 600;
	}
	.liste {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.eintrag {
		display: grid;
		gap: 8px;
		padding: 12px 16px;
		border: 1px solid var(--kante);
		border-left: 4px solid var(--gruen);
		border-radius: 10px;
		background: var(--stahl);
	}
	.eintrag.problem {
		border-left-color: var(--orange);
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}
	.titel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
	}
	.titel strong {
		font-size: 17px;
	}
	.nummer {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 14px;
	}
	.kategorie {
		color: var(--grau);
		font-size: 13px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 2px 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--farbe) 18%, transparent);
		color: var(--farbe);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.notiz {
		margin: 0;
		padding: 6px 10px;
		border-radius: 6px;
		background: var(--nacht);
		color: #c3cfd8;
		font-size: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.verlauf {
		margin-left: auto;
		color: var(--grau);
		font-size: 13px;
	}
	.verlauf summary {
		cursor: pointer;
	}
	.verlauf[open] {
		flex-basis: 100%;
		margin-left: 0;
	}
	.verlauf ol {
		display: grid;
		gap: 4px;
		margin: 8px 0 0;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--nacht);
		list-style: none;
	}
	.verlauf time {
		margin-right: 6px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 12px;
	}
	.unterformular {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
		gap: 10px;
		align-items: end;
		padding: 12px;
		border-radius: 8px;
		background: var(--nacht);
	}
	.unterformular input,
	.unterformular select {
		background: var(--stahl);
	}
	.unterformular .breit {
		grid-column: 1 / -1;
	}
	.unterformular.raster {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.unterformular > .knopf {
		grid-column: 1 / -1;
		justify-self: end;
	}
	.schmal input {
		width: 90px;
	}
	.leer {
		margin: 0;
		padding: 32px 16px;
		border: 1px dashed var(--kante);
		border-radius: 12px;
		color: var(--grau);
		text-align: center;
	}

	/* Schmal: Orte als waagerechte Leiste über der Liste. */
	@media (max-width: 860px) {
		.inhalt {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'kopf' 'orte' 'haupt';
		}
		.orte {
			position: static;
			display: flex;
			gap: 6px;
			max-height: none;
			padding: 0;
			border: 0;
			background: none;
			overflow-x: auto;
			scrollbar-width: thin;
		}
		.ort {
			flex: none;
			min-height: 38px;
			border: 1px solid var(--kante);
			border-radius: 999px;
			background: var(--stahl);
		}
		.ort.aktiv {
			border-color: var(--gelb);
		}
		.ort:first-child {
			margin-bottom: 0;
		}
		.ort-name {
			overflow: visible;
		}
	}

	@media (max-width: 700px) {
		.seite {
			padding-top: 20px;
		}
		h1 {
			font-size: 30px;
		}
		.kacheln {
			gap: 8px;
		}
		.kachel {
			min-width: 0;
			padding: 10px;
		}
		.beschriftung {
			font-size: 11px;
			letter-spacing: 0.02em;
			line-height: 1.15;
		}
		.zahl {
			font-size: 28px;
		}
		.filter,
		.raster,
		.unterformular,
		.unterformular.raster {
			grid-template-columns: 1fr;
		}
		.schmal input {
			width: 100%;
		}
		.gruppe-kopf {
			flex-direction: column;
			gap: 2px;
		}
	}
</style>
