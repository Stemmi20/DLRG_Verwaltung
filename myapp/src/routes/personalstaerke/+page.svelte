<script lang="ts">
	import { enhance } from '$app/forms';
	import { FUNKTIONEN, staerkeRechnen, type Funktion } from '$lib/staerke';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Jetzt, im Format für <input type="datetime-local">. */
	function jetzt(): string {
		const d = new Date();
		d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
		return d.toISOString().slice(0, 16);
	}

	let einsatzZeit = $state(jetzt());
	let stichwort = $state('');
	let einsatzort = $state('');
	let bemerkung = $state('');
	let zusatz = $state({ zugfuehrer: 0, gruppenfuehrer: 0, mannschaft: 0 });
	/** userId → Funktion. Wer nicht drin steht, war nicht im Einsatz. */
	let gewaehlt = $state<Record<string, Funktion>>({});
	let suche = $state('');
	let senden = $state(false);

	$effect(() => {
		if (!form?.werte) return;
		einsatzZeit = form.werte.einsatzZeit || einsatzZeit;
		stichwort = form.werte.stichwort ?? stichwort;
		einsatzort = form.werte.einsatzort ?? einsatzort;
		bemerkung = form.werte.bemerkung ?? bemerkung;
		if (form.kraefte) {
			gewaehlt = Object.fromEntries(form.kraefte.map((k) => [k.userId, k.funktion]));
		}
	});

	$effect(() => {
		if (!form?.erfolg) return;
		einsatzZeit = jetzt();
		stichwort = '';
		einsatzort = '';
		bemerkung = '';
		zusatz = { zugfuehrer: 0, gruppenfuehrer: 0, mannschaft: 0 };
		gewaehlt = {};
		suche = '';
	});

	// Die Stärkemeldung rechnet sich aus der Auswahl – so kann sie nie
	// von der Namensliste abweichen.
	const staerke = $derived(
		staerkeRechnen(
			Object.values(gewaehlt).map((funktion) => ({ funktion })),
			zusatz
		)
	);

	const gefiltert = $derived(
		data.mitglieder.filter((m) => m.name.toLowerCase().includes(suche.toLowerCase()))
	);

	function setzen(id: string, funktion: Funktion) {
		// Nochmal auf dieselbe Funktion tippen nimmt die Person wieder raus.
		if (gewaehlt[id] === funktion) {
			const { [id]: _, ...rest } = gewaehlt;
			gewaehlt = rest;
		} else {
			gewaehlt = { ...gewaehlt, [id]: funktion };
		}
	}

	function zeitText(iso: string): string {
		return new Date(iso).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head><title>Personalstärke</title></svelte:head>

<div class="seite">
	<header>
		<p>Einsatzdokumentation</p>
		<h1>Personalstärke</h1>
		<span>Wer war im Einsatz? Die Stärkemeldung rechnet sich aus der Auswahl.</span>
	</header>

	{#if form?.erfolg}<p class="hinweis erfolg">Meldung gespeichert.</p>{/if}
	{#if form?.fehler}<p class="hinweis fehler">{form.fehler}</p>{/if}

	<div class="raster">
		<form
			method="POST"
			action="?/anlegen"
			class="karte"
			use:enhance={() => {
				senden = true;
				return async ({ update }) => {
					await update({ reset: false });
					senden = false;
				};
			}}
		>
			<h2>Neue Meldung</h2>

			<!-- Die Stärke steht oben: das ist die Zahl, die durchgegeben wird. -->
			<div class="anzeige">
				<span class="zahl">{staerke.text}</span>
				<small>Zugführer / Gruppenführer / Mannschaft / Gesamt</small>
			</div>

			<label>
				Einsatzbeginn
				<input type="datetime-local" name="einsatzZeit" bind:value={einsatzZeit} required />
				{#if form?.felder?.einsatzZeit}<em>{form.felder.einsatzZeit}</em>{/if}
			</label>

			<div class="zwei">
				<label>
					Stichwort
					<input name="stichwort" bind:value={stichwort} placeholder="z. B. WASSER 3" />
				</label>
				<label>
					Einsatzort
					<input name="einsatzort" bind:value={einsatzort} placeholder="optional" />
				</label>
			</div>

			<div class="block">
				<span class="beschriftung">
					Einsatzkräfte
					<b>{Object.keys(gewaehlt).length} namentlich</b>
				</span>
				<input class="suche" bind:value={suche} placeholder="Namen suchen …" />

				<div class="liste">
					{#if gefiltert.length === 0}
						<p class="leer">Keine Mitglieder gefunden.</p>
					{/if}
					{#each gefiltert as m (m.id)}
						{@const aktuell = gewaehlt[m.id]}
						<div class="person" class:aktiv={aktuell}>
							<span class="name">{m.name}</span>
							<div class="rollen">
								{#each FUNKTIONEN as f (f.wert)}
									<button
										type="button"
										class:gesetzt={aktuell === f.wert}
										title={f.label}
										onclick={() => setzen(m.id, f.wert)}>{f.kurz}</button
									>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Verstecktes Feld je Person: "<id>:<funktion>" -->
				{#each Object.entries(gewaehlt) as [id, funktion] (id)}
					<input type="hidden" name="kraft" value="{id}:{funktion}" />
				{/each}
				{#if form?.felder?.kraefte}<em>{form.felder.kraefte}</em>{/if}
			</div>

			<div class="block">
				<span class="beschriftung">
					Weitere Kräfte ohne Namen
					<b>Nachbarortsgruppen, andere Organisationen</b>
				</span>
				<div class="drei">
					<label>
						Zugführer
						<input
							type="number"
							name="zugFuehrer"
							min="0"
							bind:value={zusatz.zugfuehrer}
						/>
					</label>
					<label>
						Gruppenführer
						<input
							type="number"
							name="GruppenFuehrer"
							min="0"
							bind:value={zusatz.gruppenfuehrer}
						/>
					</label>
					<label>
						Mannschaft
						<input
							type="number"
							name="mannschaft"
							min="0"
							bind:value={zusatz.mannschaft}
						/>
					</label>
				</div>
			</div>

			<label>
				Bemerkung
				<input name="bemerkung" bind:value={bemerkung} placeholder="optional" />
			</label>

			<button class="absenden" type="submit" disabled={senden}>
				{senden ? 'Wird gespeichert …' : 'Meldung speichern'}
			</button>
		</form>

		<section class="karte">
			<h2>Bisherige Meldungen</h2>
			{#if data.meldungen.length === 0}
				<p class="leer">Noch keine Meldung erfasst.</p>
			{:else}
				<ul>
					{#each data.meldungen as m (m.id)}
						<li>
							<div class="kopf">
								<strong>{m.stichwort || 'Einsatz'}</strong>
								<b>{m.staerke.text}</b>
							</div>
							<div class="fuss">
								<span>{zeitText(m.einsatzZeit)}</span>
								{#if m.einsatzort}<span>{m.einsatzort}</span>{/if}
								<span>gemeldet von {m.gemeldetVonName}</span>
							</div>
							{#if m.kraefte.length}
								<div class="crew">{m.kraefte.map((k) => k.name).join(', ')}</div>
							{/if}
							{#if m.zusatz.fuehrer + m.zusatz.unterfuehrer + m.zusatz.mannschaft > 0}
								<div class="crew">
									zusätzlich {m.zusatz.fuehrer + m.zusatz.unterfuehrer + m.zusatz.mannschaft}
									ohne Namen
								</div>
							{/if}
							{#if m.bemerkung}<div class="bemerkung">{m.bemerkung}</div>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<style>
	.seite {
		min-height: 100vh;
		padding: 32px max(20px, calc((100vw - 1360px) / 2)) 48px;
		background: radial-gradient(circle at 50% -25%, #dededb, #c8c8c5 65%);
		color: #575756;
	}
	header p {
		margin: 0 0 7px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 1.7px;
		font-size: 9px;
		font-weight: 700;
	}
	header h1 {
		margin: 0;
		font-size: 32px;
	}
	header > span {
		display: block;
		margin-top: 8px;
		color: #747473;
		font-size: 12px;
	}
	.hinweis {
		margin: 18px 0 0;
		padding: 13px 16px;
		border-radius: 8px;
		font-size: 12px;
	}
	.erfolg {
		background: #e8f6f0;
		border-left: 4px solid #16855b;
		color: #16855b;
	}
	.fehler {
		background: #ffe4e6;
		border-left: 4px solid #e30613;
		color: #be0712;
	}
	.raster {
		margin-top: 20px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	.karte {
		padding: 24px;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
		display: grid;
		gap: 15px;
	}
	.karte h2 {
		margin: 0;
		padding-bottom: 13px;
		border-bottom: 3px solid #ffed00;
		font-size: 18px;
	}

	/* Die Stärkemeldung als große Zahl – das ist die Information, die zählt. */
	.anzeige {
		padding: 18px;
		border-radius: 10px;
		background: #575756;
		text-align: center;
	}
	.anzeige .zahl {
		display: block;
		color: #ffed00;
		font-size: 34px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 1px;
	}
	.anzeige small {
		display: block;
		margin-top: 5px;
		color: #ffffffb0;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.9px;
	}

	label,
	.beschriftung {
		display: block;
		font-size: 10px;
		font-weight: 700;
	}
	input {
		width: 100%;
		height: 42px;
		margin-top: 7px;
		padding: 0 12px;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
		outline: none;
	}
	input:focus {
		border-color: #e30613;
		box-shadow: 0 0 0 3px #e3061312;
	}
	em {
		display: block;
		margin-top: 5px;
		color: #e30613;
		font-size: 10px;
		font-style: normal;
	}
	.zwei {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.drei {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 10px;
	}
	.block {
		padding-top: 4px;
	}
	.beschriftung b {
		float: right;
		color: #888;
		font-weight: 400;
	}
	.suche {
		margin-top: 9px;
	}
	.liste {
		max-height: 260px;
		margin-top: 9px;
		border: 1px solid #e5e5e3;
		border-radius: 8px;
		overflow: auto;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border-bottom: 1px solid #ececea;
		font-size: 11px;
	}
	.person:last-child {
		border: 0;
	}
	.person.aktiv {
		background: #e3061308;
	}
	.person .name {
		flex: 1;
		min-width: 0;
	}
	.person.aktiv .name {
		font-weight: 700;
	}
	.rollen {
		display: flex;
		gap: 4px;
		flex: none;
	}
	.rollen button {
		width: 34px;
		height: 30px;
		border: 1px solid #d3d3d0;
		border-radius: 6px;
		background: #fff;
		color: #888;
		font-size: 10px;
		font-weight: 700;
	}
	.rollen button:hover {
		border-color: #e30613;
		color: #e30613;
	}
	.rollen button.gesetzt {
		border-color: #e30613;
		background: #e30613;
		color: #fff;
	}
	.absenden {
		height: 46px;
		border: 0;
		border-radius: 7px;
		background: #e30613;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
	}
	.absenden:disabled {
		opacity: 0.5;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: 720px;
		overflow: auto;
	}
	li {
		padding: 13px 0;
		border-bottom: 1px solid #ececea;
	}
	li:last-child {
		border: 0;
	}
	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.kopf strong {
		font-size: 13px;
	}
	.kopf b {
		flex: none;
		padding: 4px 10px;
		border-radius: 16px;
		background: #ffed00;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.fuss {
		margin-top: 6px;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		color: #888;
		font-size: 9px;
	}
	.crew {
		margin-top: 6px;
		font-size: 10px;
		color: #666;
	}
	.bemerkung {
		margin-top: 6px;
		padding-left: 9px;
		border-left: 3px solid #e5e5e3;
		font-size: 10px;
		font-style: italic;
		color: #666;
	}
	.leer {
		padding: 22px;
		color: #999;
		text-align: center;
		font-size: 11px;
	}

	@media (max-width: 1000px) {
		.raster {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.seite {
			padding: 20px 14px 32px;
		}
		.karte {
			padding: 18px;
		}
		.zwei {
			grid-template-columns: 1fr;
		}
		header h1 {
			font-size: 25px;
		}
	}
</style>