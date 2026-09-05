<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const heute = new Date().toISOString().slice(0, 10);

	let datum = $state(heute);
	let fahrtgrund = $state('');
	let strecke = $state<string[]>(['', '']);
	let kmStart = $state(String(data.kmStand));
	let kmEnde = $state('');
	let bemerkung = $state('');
	let gewaehlt = $state<string[]>([]);
	let suche = $state('');
	let senden = $state(false);

	// Nach einem Fehlversuch die Eingaben zurückholen.
	$effect(() => {
		if (!form?.werte) return;
		datum = form.werte.datum ?? datum;
		fahrtgrund = form.werte.fahrtgrund ?? fahrtgrund;
		kmStart = form.werte.kmStart ?? kmStart;
		kmEnde = form.werte.kmEnde ?? kmEnde;
		bemerkung = form.werte.bemerkung ?? bemerkung;
		if (form.strecke?.length) strecke = [...form.strecke];
		if (form.mitfahrerIds) gewaehlt = [...form.mitfahrerIds];
	});

	// Nach erfolgreichem Speichern das Formular leeren – der neue
	// Kilometerstand kommt über das neu geladene `data` herein.
	$effect(() => {
		if (!form?.erfolg) return;
		fahrtgrund = '';
		strecke = ['', ''];
		kmStart = String(data.kmStand);
		kmEnde = '';
		bemerkung = '';
		gewaehlt = [];
	});

	const gefahren = $derived.by(() => {
		const s = Number(kmStart);
		const e = Number(kmEnde);
		return Number.isFinite(s) && Number.isFinite(e) && e >= s ? e - s : null;
	});

	const freiePlaetze = $derived(data.fahrzeug.sitzplaetze - 1 - gewaehlt.length);

	const gefiltert = $derived(
		data.mitglieder.filter(
			(m) => m.id !== data.fahrer.id && m.name.toLowerCase().includes(suche.toLowerCase())
		)
	);

	function umschalten(id: string) {
		gewaehlt = gewaehlt.includes(id) ? gewaehlt.filter((x) => x !== id) : [...gewaehlt, id];
	}

	function stationHinzu() {
		strecke = [...strecke, ''];
	}
	function stationWeg(index: number) {
		if (strecke.length > 2) strecke = strecke.filter((_, i) => i !== index);
	}

	function datumText(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>{data.fahrzeug.funkrufname} · Fahrtenbuch</title></svelte:head>

<div class="seite">
	<header>
		<a href="/fahrtenbuch">← Alle Fahrzeuge</a>
		<p>Fahrtenbuch</p>
		<h1>{data.fahrzeug.funkrufname}</h1>
		<span>
			{data.fahrzeug.sitzplaetze} Sitzplätze inklusive Fahrer · Aktueller Stand
			{data.kmStand.toLocaleString('de-DE')} km
		</span>
	</header>

	{#if form?.erfolg}
		<p class="hinweis erfolg">Fahrt eingetragen.</p>
	{/if}
	{#if form?.fehler}
		<p class="hinweis fehler">{form.fehler}</p>
	{/if}

	<div class="raster">
		<form
			method="POST"
			action="?/anlegen"
			class="karte formular"
			use:enhance={() => {
				senden = true;
				return async ({ update }) => {
					await update({ reset: false });
					senden = false;
				};
			}}
		>
			<h2>Neue Fahrt</h2>

			<div class="zeile zwei">
				<label>
					Datum
					<input type="date" name="datum" bind:value={datum} max={heute} required />
					{#if form?.felder?.datum}<em>{form.felder.datum}</em>{/if}
				</label>
				<label>
					Fahrer
					<input value={data.fahrer.name} disabled />
				</label>
			</div>

			<label>
				Fahrtgrund
				<input
					name="fahrtgrund"
					bind:value={fahrtgrund}
					placeholder="z. B. Einsatzfahrt Uferbereich, Materialtransport, Ausbildung"
					required
				/>
				{#if form?.felder?.fahrtgrund}<em>{form.felder.fahrtgrund}</em>{/if}
			</label>

			<div class="strecke">
				<span class="beschriftung">Strecke</span>
				{#each strecke as _, i}
					<div class="station">
						<i>{i === 0 ? 'Start' : i === strecke.length - 1 ? 'Ziel' : 'über'}</i>
						<input
							name="strecke"
							bind:value={strecke[i]}
							placeholder={i === 0 ? 'Wache Seestraße' : 'Ort oder Adresse'}
						/>
						<button
							type="button"
							class="weg"
							disabled={strecke.length <= 2}
							aria-label="Station entfernen"
							onclick={() => stationWeg(i)}>×</button
						>
					</div>
				{/each}
				<button type="button" class="dazu" onclick={stationHinzu}>+ Zwischenstation</button>
				{#if form?.felder?.strecke}<em>{form.felder.strecke}</em>{/if}
			</div>

			<div class="zeile drei">
				<label>
					km Start
					<input type="number" name="kmStart" bind:value={kmStart} min="0" required />
					{#if form?.felder?.kmStart}<em>{form.felder.kmStart}</em>{/if}
				</label>
				<label>
					km Ende
					<input type="number" name="kmEnde" bind:value={kmEnde} min="0" required />
					{#if form?.felder?.kmEnde}<em>{form.felder.kmEnde}</em>{/if}
				</label>
				<label>
					Gefahren
					<input value={gefahren === null ? '—' : `${gefahren} km`} disabled />
				</label>
			</div>

			<div class="mitfahrer">
				<span class="beschriftung">
					Mitfahrer
					<b class:voll={freiePlaetze <= 0}>
						{gewaehlt.length + 1} von {data.fahrzeug.sitzplaetze} belegt
					</b>
				</span>
				<input class="suche" bind:value={suche} placeholder="Namen suchen …" />
				<div class="liste">
					{#each gefiltert as m (m.id)}
						{@const aktiv = gewaehlt.includes(m.id)}
						<label class="person" class:aktiv>
							<input
								type="checkbox"
								name="mitfahrer"
								value={m.id}
								checked={aktiv}
								disabled={!aktiv && freiePlaetze <= 0}
								onchange={() => umschalten(m.id)}
							/>
							<span>{m.name}</span>
						</label>
					{:else}
						<p class="leer">Keine Mitglieder gefunden.</p>
					{/each}
				</div>
				{#if form?.felder?.mitfahrer}<em>{form.felder.mitfahrer}</em>{/if}
			</div>

			<label>
				Bemerkung
				<input name="bemerkung" bind:value={bemerkung} placeholder="optional" />
			</label>

			<button class="absenden" type="submit" disabled={senden}>
				{senden ? 'Wird gespeichert …' : 'Fahrt eintragen'}
			</button>
		</form>

		<section class="karte verlauf">
			<h2>Eingetragene Fahrten</h2>
			{#if data.fahrten.length === 0}
				<p class="leer">Für dieses Fahrzeug ist noch keine Fahrt eingetragen.</p>
			{:else}
				<ul>
					{#each data.fahrten as f (f.id)}
						<li>
							<div class="kopf">
								<strong>{f.fahrtgrund}</strong>
								<b>{f.gefahren} km</b>
							</div>
							<div class="weg-zeile">{f.strecke.join(' → ')}</div>
							<div class="fuss">
								<span>{datumText(f.datum)}</span>
								<span>{f.fahrerName}</span>
								<span>{f.kmStart.toLocaleString('de-DE')} → {f.kmEnde.toLocaleString('de-DE')} km</span>
							</div>
							{#if f.mitfahrer.length}
								<div class="crew">
									{f.mitfahrer.length}
									{f.mitfahrer.length === 1 ? 'Mitfahrer' : 'Mitfahrer'}:
									{f.mitfahrer.map((m) => m.name).join(', ')}
								</div>
							{/if}
							{#if f.bemerkung}<div class="bemerkung">{f.bemerkung}</div>{/if}
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
	header a {
		color: #e30613;
		font-size: 11px;
		font-weight: 700;
		text-decoration: none;
	}
	header p {
		margin: 14px 0 7px;
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
	}
	.karte h2 {
		margin: 0 0 18px;
		padding-bottom: 13px;
		border-bottom: 3px solid #ffed00;
		font-size: 18px;
	}
	.formular {
		display: grid;
		gap: 15px;
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
	input:disabled {
		background: #f1f1ef;
		color: #888;
	}
	em {
		display: block;
		margin-top: 5px;
		color: #e30613;
		font-size: 10px;
		font-style: normal;
	}
	.zeile {
		display: grid;
		gap: 12px;
	}
	.zeile.zwei {
		grid-template-columns: 1fr 1fr;
	}
	.zeile.drei {
		grid-template-columns: 1fr 1fr 1fr;
	}

	/* ─── Strecke ─── */
	.station {
		display: grid;
		grid-template-columns: 52px minmax(0, 1fr) 32px;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
	}
	.station i {
		color: #888;
		font-size: 9px;
		font-style: normal;
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}
	.station input {
		margin: 0;
	}
	.weg {
		height: 34px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #e30613;
		font-size: 19px;
	}
	.weg:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}
	.dazu {
		margin-top: 9px;
		padding: 8px 12px;
		border: 1px dashed #c9c9c8;
		border-radius: 6px;
		background: transparent;
		color: #575756;
		font-size: 10px;
		font-weight: 700;
	}
	.dazu:hover {
		border-color: #e30613;
		color: #e30613;
	}

	/* ─── Mitfahrer ─── */
	.beschriftung b {
		float: right;
		color: #888;
		font-weight: 400;
	}
	.beschriftung b.voll {
		color: #e30613;
		font-weight: 700;
	}
	.suche {
		margin-top: 9px;
	}
	.liste {
		max-height: 210px;
		margin-top: 9px;
		border: 1px solid #e5e5e3;
		border-radius: 8px;
		overflow: auto;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		border-bottom: 1px solid #ececea;
		font-size: 11px;
		font-weight: 400;
		cursor: pointer;
	}
	.person:last-child {
		border: 0;
	}
	.person.aktiv {
		background: #e3061308;
		font-weight: 700;
	}
	.person input {
		width: 17px;
		height: 17px;
		margin: 0;
		flex: none;
	}
	.person:has(input:disabled) {
		opacity: 0.4;
		cursor: not-allowed;
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

	/* ─── Verlauf ─── */
	.verlauf ul {
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: 720px;
		overflow: auto;
	}
	.verlauf li {
		padding: 14px 0;
		border-bottom: 1px solid #ececea;
	}
	.verlauf li:last-child {
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
		padding: 4px 9px;
		border-radius: 16px;
		background: #ffed00;
		font-size: 11px;
	}
	.weg-zeile {
		margin-top: 6px;
		color: #575756;
		font-size: 11px;
	}
	.fuss {
		margin-top: 7px;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		color: #888;
		font-size: 9px;
	}
	.crew,
	.bemerkung {
		margin-top: 7px;
		font-size: 10px;
		color: #666;
	}
	.bemerkung {
		padding-left: 9px;
		border-left: 3px solid #e5e5e3;
		font-style: italic;
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
		.zeile.zwei,
		.zeile.drei {
			grid-template-columns: 1fr;
		}
		header h1 {
			font-size: 25px;
		}
	}
</style>