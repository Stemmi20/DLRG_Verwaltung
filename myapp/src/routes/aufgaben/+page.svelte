<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { FILTER, KURZ_MAX, STATUS_TEXT, zeitDe, type FilterName } from '$lib/aufgaben';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Die Aktionen liefern verschiedene Formen – hier eine gemeinsame Sicht. */
	const antwort = $derived(
		form as {
			fehler?: string;
			aufgabenID?: number | null;
			erstellt?: boolean;
			formular?: boolean;
			kurz?: string;
			lang?: string;
		} | null,
	);

	let formularOffen = $state(false);
	let arbeitet = $state<string | null>(null);

	// Nach einem Fehler beim Anlegen bleibt das Formular offen.
	$effect(() => {
		if (antwort?.formular) formularOffen = true;
		if (antwort?.erstellt) formularOffen = false;
	});

	const kacheln: { filter: FilterName; text: string; zahl: number; zusatz: string; farbe: string }[] =
		$derived([
			{
				filter: 'offen',
				text: 'Offen',
				zahl: data.zahlen.offen,
				zusatz: data.zahlen.zurueckgegeben ? `davon ${data.zahlen.zurueckgegeben} zurückgegeben` : 'warten auf jemanden',
				farbe: 'rot',
			},
			{
				filter: 'bearbeitung',
				text: 'In Bearbeitung',
				zahl: data.zahlen.bearbeitung,
				zusatz: data.zahlen.meine ? `${data.zahlen.meine} davon bei dir` : 'gerade vergeben',
				farbe: 'gelb',
			},
			{
				filter: 'erledigt',
				text: 'Erledigt',
				zahl: data.zahlen.erledigt,
				zusatz: 'insgesamt',
				farbe: 'gruen',
			},
		]);

	/** Nur der gedrückte Knopf zeigt „…", die anderen bleiben bedienbar. */
	function senden(schluessel: string): SubmitFunction {
		return () => {
			arbeitet = schluessel;
			return async ({ update }) => {
				await update({ reset: schluessel === 'neu' });
				arbeitet = null;
			};
		};
	}

	const leerText: Record<FilterName, string> = {
		offen: 'Keine offenen Aufgaben – alles vergeben.',
		bearbeitung: 'Gerade ist nichts in Bearbeitung.',
		erledigt: 'Noch keine erledigten Aufgaben.',
		alle: 'Noch keine Aufgaben vorhanden.',
	};
</script>

<svelte:head><title>RWS Aufgaben</title></svelte:head>

<div class="seite">
	<div class="inhalt">
		<header class="kopf">
			<div>
				<p class="ueber">Ortsgruppe {data.ortsgruppe || '–'}</p>
				<h1>RWS Aufgaben</h1>
			</div>
			<button class="knopf rot" onclick={() => (formularOffen = !formularOffen)} aria-expanded={formularOffen}>
				{formularOffen ? 'Schließen' : '+ Neue Aufgabe'}
			</button>
		</header>

		{#if formularOffen}
			<form method="POST" action="?/erstellen" class="panel neu" use:enhance={senden('neu')}>
				<h2>Neue Aufgabe</h2>
				<label>
					<span>Titel</span>
					<input
						name="kurz"
						required
						maxlength={KURZ_MAX}
						value={antwort?.kurz ?? ''}
						placeholder="z. B. Rettungsweste 3 prüfen"
					/>
				</label>
				<label>
					<span>Beschreibung</span>
					<textarea name="lang" rows="4" placeholder="Was genau ist zu tun? Wo, bis wann?">{antwort?.lang ?? ''}</textarea>
				</label>
				{#if antwort?.formular && antwort.fehler}<p class="fehlertext">{antwort.fehler}</p>{/if}
				<div class="leiste">
					<small>Erscheint sofort für alle aus der Ortsgruppe {data.ortsgruppe}.</small>
					<button class="knopf rot" disabled={arbeitet === 'neu'}>
						{arbeitet === 'neu' ? 'Speichert …' : 'Aufgabe anlegen'}
					</button>
				</div>
			</form>
		{/if}

		{#if antwort?.erstellt}<p class="hinweis gut">Aufgabe angelegt.</p>{/if}

		<section class="kacheln" aria-label="Übersicht">
			{#each kacheln as k (k.filter)}
				<a
					class="kachel {k.farbe}"
					class:aktiv={data.filter === k.filter}
					href="?filter={k.filter}"
					data-sveltekit-noscroll
				>
					<span class="beschriftung">{k.text}</span>
					<strong class="zahl">{k.zahl}</strong>
					<small>{k.zusatz}</small>
				</a>
			{/each}
		</section>

		<nav class="reiter" aria-label="Filter">
			{#each Object.entries(FILTER) as [name, f] (name)}
				<a href="?filter={name}" class:aktiv={data.filter === name} data-sveltekit-noscroll>{f.text}</a>
			{/each}
		</nav>

		<section class="liste">
			{#each data.aufgaben as a (a.aufgabenID)}
				<article class="panel aufgabe status-{a.status.toLowerCase()}" class:meine={a.meine}>
					<div class="zeile">
						<span class="pille">{a.meine ? 'Dir zugewiesen' : STATUS_TEXT[a.status]}</span>
						<small class="zeit">erstellt {zeitDe(a.erstelltAm)}</small>
					</div>
					<h3>{a.kurz}</h3>
					{#if a.lang && a.lang !== a.kurz}<p class="text">{a.lang}</p>{/if}

					{#if a.bearbeiter}
						<p class="bearbeiter">
							<span class="punkt"></span>
							{a.meine ? 'Du bearbeitest diese Aufgabe' : `In Bearbeitung bei ${a.bearbeiter}`}
						</p>
					{/if}

					{#if antwort?.aufgabenID === a.aufgabenID && antwort.fehler}
						<p class="fehlertext">{antwort.fehler}</p>
					{/if}

					<div class="aktionen">
						{#if a.status === 'OPEN' || a.status === 'PENDING'}
							<form method="POST" action="?/uebernehmen" use:enhance={senden(`u${a.aufgabenID}`)}>
								<input type="hidden" name="aufgabenID" value={a.aufgabenID} />
								<button class="knopf rot" disabled={arbeitet === `u${a.aufgabenID}`}>
									{arbeitet === `u${a.aufgabenID}` ? '…' : 'Mir zuweisen'}
								</button>
							</form>
						{:else if a.meine}
							<form method="POST" action="?/erledigen" use:enhance={senden(`e${a.aufgabenID}`)}>
								<input type="hidden" name="aufgabenID" value={a.aufgabenID} />
								<button class="knopf gruen" disabled={arbeitet === `e${a.aufgabenID}`}>
									{arbeitet === `e${a.aufgabenID}` ? '…' : 'Erledigt'}
								</button>
							</form>
							<form method="POST" action="?/abgeben" use:enhance={senden(`a${a.aufgabenID}`)}>
								<input type="hidden" name="aufgabenID" value={a.aufgabenID} />
								<button class="knopf leise" disabled={arbeitet === `a${a.aufgabenID}`}>
									{arbeitet === `a${a.aufgabenID}` ? '…' : 'Abgeben'}
								</button>
							</form>
						{:else if a.status === 'TAKEN' && data.istAdmin}
							<form method="POST" action="?/abgeben" use:enhance={senden(`a${a.aufgabenID}`)}>
								<input type="hidden" name="aufgabenID" value={a.aufgabenID} />
								<button class="knopf leise" disabled={arbeitet === `a${a.aufgabenID}`}>
									{arbeitet === `a${a.aufgabenID}` ? '…' : 'Als Admin freigeben'}
								</button>
							</form>
						{/if}

						{#if a.verlauf.length}
							<details class="verlauf">
								<summary>Verlauf ({a.verlauf.length})</summary>
								<ol>
									{#each a.verlauf as v, i (i)}
										<li><time>{zeitDe(v.am)}</time> {v.text}</li>
									{/each}
								</ol>
							</details>
						{/if}
					</div>
				</article>
			{:else}
				<p class="leer">{leerText[data.filter]}</p>
			{/each}
		</section>
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
		gap: 18px;
		max-width: 56rem;
		margin: 0 auto;
	}
	h1,
	h2,
	h3,
	.beschriftung,
	.knopf,
	.reiter a,
	.pille {
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
		transition: transform 0.1s, background-color 0.15s;
	}
	.knopf:active:not(:disabled) {
		transform: scale(0.97);
	}
	.knopf:focus-visible,
	.reiter a:focus-visible,
	.kachel:focus-visible {
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
	.knopf.gruen {
		border-color: var(--gruen);
		background: var(--gruen);
		color: var(--nacht);
	}
	.knopf.leise {
		color: var(--grau);
	}
	.knopf.leise:hover:not(:disabled) {
		border-color: var(--grau);
		color: var(--eis);
	}
	.knopf:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.hinweis {
		margin: 0;
		padding: 12px 16px;
		border-left: 4px solid var(--grau);
		border-radius: 8px;
		background: var(--stahl);
		font-size: 14px;
	}
	.hinweis.gut {
		border-color: var(--gruen);
	}
	.fehlertext {
		margin: 0;
		color: #ff6b73;
		font-size: 14px;
	}

	/* ─── Neue Aufgabe ─── */
	.neu {
		display: grid;
		gap: 14px;
	}
	.neu h2 {
		margin: 0;
		font-size: 22px;
		text-transform: uppercase;
	}
	.neu label {
		display: grid;
		gap: 6px;
	}
	.neu label span {
		color: var(--grau);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.neu input,
	.neu textarea {
		width: 100%;
		padding: 11px 13px;
		border: 1px solid var(--kante);
		border-radius: 8px;
		background: var(--nacht);
		color: var(--eis);
		font: inherit;
		font-size: 16px;
	}
	.neu textarea {
		resize: vertical;
	}
	.neu input:focus,
	.neu textarea:focus {
		border-color: var(--wasser);
		outline: none;
	}
	.leiste {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		color: var(--grau);
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
		padding: 16px 18px;
		border: 1px solid var(--kante);
		border-top: 4px solid var(--farbe);
		border-radius: 12px;
		background: var(--stahl);
		color: var(--eis);
		text-decoration: none;
	}
	.kachel.rot {
		--farbe: var(--rot);
	}
	.kachel.gelb {
		--farbe: var(--gelb);
	}
	.kachel.gruen {
		--farbe: var(--gruen);
	}
	.kachel:hover {
		border-color: var(--farbe);
	}
	.kachel.aktiv {
		background: color-mix(in srgb, var(--farbe) 12%, var(--stahl));
	}
	.beschriftung {
		color: var(--grau);
		font-size: 15px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.zahl {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 44px;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.05;
	}
	.kachel small {
		color: var(--grau);
		font-size: 12px;
	}

	/* ─── Reiter ─── */
	.reiter {
		display: flex;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--kante);
		border-radius: 10px;
		background: var(--stahl);
		overflow-x: auto;
	}
	.reiter a {
		flex: 1;
		padding: 8px 12px;
		border-radius: 7px;
		color: var(--grau);
		font-size: 16px;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.reiter a.aktiv {
		background: var(--kante);
		color: var(--eis);
	}

	/* ─── Aufgaben ─── */
	.liste {
		display: grid;
		gap: 12px;
	}
	.aufgabe {
		--farbe: var(--rot);
		display: grid;
		gap: 8px;
		border-left: 4px solid var(--farbe);
	}
	.status-taken {
		--farbe: var(--gelb);
	}
	.status-done {
		--farbe: var(--gruen);
		opacity: 0.75;
	}
	.aufgabe.meine {
		border-color: var(--gelb);
		box-shadow: 0 0 0 1px var(--gelb) inset;
	}
	.zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.pille {
		padding: 2px 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--farbe) 18%, transparent);
		color: var(--farbe);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.status-pending .pille {
		--farbe: #ff8a3d;
	}
	.meine .pille {
		background: var(--gelb);
		color: var(--nacht);
	}
	.zeit {
		color: var(--grau);
		font-size: 12px;
	}
	h3 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
		line-height: 1.15;
	}
	.text {
		margin: 0;
		color: #c3cfd8;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.bearbeiter {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 14px;
	}
	.punkt {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--gelb);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
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
	.leer {
		margin: 0;
		padding: 32px 16px;
		border: 1px dashed var(--kante);
		border-radius: 12px;
		color: var(--grau);
		text-align: center;
	}

	@media (max-width: 640px) {
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
			padding: 12px 10px;
		}
		.beschriftung {
			font-size: 12px;
			letter-spacing: 0.02em;
			line-height: 1.15;
			overflow-wrap: anywhere;
		}
		.zahl {
			font-size: 32px;
		}
		.kachel small {
			display: none;
		}
		.leiste {
			flex-direction: column;
			align-items: stretch;
		}
		.aktionen form,
		.aktionen .knopf {
			flex: 1;
		}
		.aktionen form .knopf {
			width: 100%;
		}
	}
</style>