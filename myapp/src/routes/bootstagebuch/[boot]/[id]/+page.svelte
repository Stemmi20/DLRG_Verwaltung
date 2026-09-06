<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ALARMIERUNG,
		EINSATZARTEN,
		FUNKTIONEN,
		KONTROLLPUNKTE_LINKS,
		KONTROLLPUNKTE_RECHTS,
		WETTERFELDER
	} from '$lib/bootstagebuch/felder';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const b = data.blatt;

	// ── Kopf ──
	let liegeort = $state(b.liegeort);
	let funkname = $state(b.funkname);
	let datum = $state(b.datum);

	// ── Kontrolle und Freitext ──
	let kontrolle = $state<string[]>([...b.kontrolle]);
	let schaeden = $state(b.schaeden ?? '');
	let reparaturen = $state(b.reparaturen ?? '');

	// ── Wetter: zwei feste Zeitraeume ──
	function wetterWert(zeitraum: 'vormittag' | 'nachmittag', feld: string): string {
		const zeile = b.wetter.find((w) => w.zeitraum === zeitraum);
		return ((zeile as Record<string, unknown> | undefined)?.[feld] as string) ?? '';
	}
	let wetter = $state<Record<string, string>>(
		Object.fromEntries(
			(['vormittag', 'nachmittag'] as const).flatMap((z) =>
				WETTERFELDER.map((f) => [`${z}_${f.id}`, wetterWert(z, f.id)])
			)
		)
	);

	// ── Maschinen ──
	let maschinen = $state(
		b.maschinen.map((m) => ({
			maschineId: m.maschineId,
			bezeichnung: m.bezeichnung,
			anUhrzeit: m.anUhrzeit ?? '',
			anOrt: m.anOrt ?? '',
			abUhrzeit: m.abUhrzeit ?? '',
			abOrt: m.abOrt ?? '',
			anfang: m.betriebsstundenAnfang?.toString() ?? '',
			ende: m.betriebsstundenEnde?.toString() ?? ''
		}))
	);

	// ── Tank ──
	let tankBeginn = $state(b.tankBeginn?.toString() ?? '');
	let tankEnde = $state(b.tankEnde?.toString() ?? '');
	let getanktLiter = $state(b.getanktLiter?.toString() ?? '');
	let getanktBetrag = $state(b.getanktBetrag?.toString() ?? '');
	let tankort = $state(b.tankort ?? '');

	// ── Seite 2 ──
	let grundDerFahrt = $state(b.grundDerFahrt ?? '');
	let bereich = $state(b.bereich ?? '');
	let alarmierung = $state<string[]>([...b.alarmierung]);
	let patientUebergeben = $state(b.patientUebergeben);
	let mitNotarzt = $state(b.mitNotarzt);
	let mitReanimation = $state(b.mitReanimation);
	let einsatzarten = $state<string[]>([...b.einsatzarten]);
	let einsatzprotokoll = $state(
		b.einsatzprotokollWeitergeleitet === null ? '' : b.einsatzprotokollWeitergeleitet ? 'ja' : 'nein'
	);
	let rueckmeldung = $state(
		b.rueckmeldungWeitergeleitet === null ? '' : b.rueckmeldungWeitergeleitet ? 'ja' : 'nein'
	);
	let bootsfuehrerName = $state(b.bootsfuehrerName ?? '');
	let bootssteuererName = $state(b.bootssteuererName ?? '');

	// ── Zeilenlisten ──
	type BesatzungZeile = {
		name: string;
		organisation: string;
		funktion: string;
		von: string;
		bis: string;
		std: string;
	};
	const leereBesatzung = (): BesatzungZeile => ({
		name: '',
		organisation: '',
		funktion: 'WRH',
		von: '',
		bis: '',
		std: ''
	});
	let besatzung = $state<BesatzungZeile[]>(
		b.besatzung.length
			? b.besatzung.map((z) => ({
					name: z.name,
					organisation: z.organisation ?? '',
					funktion: z.funktion,
					von: z.von ?? '',
					bis: z.bis ?? '',
					std: z.dienstzeitStd?.toString() ?? ''
				}))
			: [leereBesatzung()]
	);

	type DienstZeile = { uhrzeit: string; ort: string; anlass: string };
	const leererDienst = (): DienstZeile => ({ uhrzeit: '', ort: '', anlass: '' });
	let dienstangaben = $state<DienstZeile[]>(
		b.dienstangabe.length
			? b.dienstangabe.map((z) => ({
					uhrzeit: z.uhrzeit ?? '',
					ort: z.ort ?? '',
					anlass: z.anlass ?? ''
				}))
			: [leererDienst()]
	);

	let senden = $state(false);

	// ── Berechnet, nie gespeichert ──
	function differenz(anfang: string, ende: string): number | null {
		if (anfang.trim() === '' || ende.trim() === '') return null;
		const a = Number(anfang.replace(',', '.'));
		const e = Number(ende.replace(',', '.'));
		if (!Number.isFinite(a) || !Number.isFinite(e) || e < a) return null;
		return Math.round((e - a) * 10) / 10;
	}

	const gesamtdienstzeit = $derived(
		Math.round(
			besatzung.reduce((s, z) => {
				const n = Number(z.std.replace(',', '.'));
				return s + (Number.isFinite(n) ? n : 0);
			}, 0) * 100
		) / 100
	);

	/*
	 * Die Tankanzeige steht in Prozent, das Nachtanken in Litern – beides
	 * lässt sich nicht verrechnen. Deshalb nur die Differenz der Anzeige;
	 * wurde zwischendrin getankt, sagt sie nichts über den Verbrauch aus.
	 */
	const tankDifferenz = $derived.by(() => {
		if (tankBeginn.trim() === '' || tankEnde.trim() === '') return null;
		const beginn = Number(tankBeginn.replace(',', '.'));
		const ende = Number(tankEnde.replace(',', '.'));
		if (!Number.isFinite(beginn) || !Number.isFinite(ende)) return null;
		const wert = beginn - ende;
		return wert >= 0 ? Math.round(wert * 10) / 10 : null;
	});

	function umschalten(liste: string[], id: string): string[] {
		return liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
	}

	function datumText(iso: string): string {
		return new Date(iso).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head><title>{b.funkname} · Bootstagebuch</title></svelte:head>

<div class="seite">
	<header>
		<a href="/bootstagebuch/{data.boot.id}">← Alle Blätter von {data.boot.funkname}</a>
		<p>Bootstagebuch</p>
		<h1>{b.funkname}</h1>
		<span>
			{b.liegeort} · angelegt von {b.erstelltVonName} · zuletzt geändert {datumText(b.geaendertAm)}
			{#if b.unterschriebenAm}· unterschrieben {datumText(b.unterschriebenAm)}{/if}
		</span>
	</header>

	{#if form?.erfolg}
		<p class="hinweis erfolg">Gespeichert.</p>
	{/if}
	{#if form?.unterschrieben}
		<p class="hinweis erfolg">Als unterschrieben vermerkt.</p>
	{/if}
	{#if form?.fehler}
		<p class="hinweis fehler">{form.fehler}</p>
	{/if}

	<form
		method="POST"
		action="?/speichern"
		use:enhance={() => {
			senden = true;
			return async ({ update }) => {
				await update({ reset: false });
				senden = false;
			};
		}}
	>
		<!-- ─────────────────────────────── Kopf ─────────────────────────── -->
		<section class="karte">
			<h2>Kopf</h2>
			<div class="zeile drei">
				<label>
					Liegeort
					<input name="liegeort" bind:value={liegeort} required />
					{#if form?.felder?.liegeort}<em>{form.felder.liegeort}</em>{/if}
				</label>
				<label>
					Funkname
					<input name="funkname" bind:value={funkname} required />
					{#if form?.felder?.funkname}<em>{form.felder.funkname}</em>{/if}
				</label>
				<label>
					Datum
					<input type="date" name="datum" bind:value={datum} required />
					{#if form?.felder?.datum}<em>{form.felder.datum}</em>{/if}
				</label>
			</div>
		</section>

		<!-- ──────────────────── Kontrolle vor Dienstbeginn ───────────────── -->
		<section class="karte">
			<h2>Kontrolle vor Dienstbeginn</h2>
			<div class="zeile zwei">
				<div class="haken">
					{#each KONTROLLPUNKTE_LINKS as punkt}
						<label class="haken-zeile">
							<input
								type="checkbox"
								name="kontrolle"
								value={punkt.id}
								checked={kontrolle.includes(punkt.id)}
								onchange={() => (kontrolle = umschalten(kontrolle, punkt.id))}
							/>
							<span>{punkt.label}</span>
						</label>
					{/each}
				</div>
				<div class="haken">
					{#each KONTROLLPUNKTE_RECHTS as punkt}
						<label class="haken-zeile">
							<input
								type="checkbox"
								name="kontrolle"
								value={punkt.id}
								checked={kontrolle.includes(punkt.id)}
								onchange={() => (kontrolle = umschalten(kontrolle, punkt.id))}
							/>
							<span>{punkt.label}</span>
						</label>
					{/each}
				</div>
			</div>
		</section>

		<!-- ────────────────────── Schäden und Reparaturen ────────────────── -->
		<section class="karte">
			<h2>Schäden und Reparaturen</h2>
			<label>
				Schäden am Boot
				<textarea name="schaeden" rows="3" bind:value={schaeden}></textarea>
			</label>
			<label>
				Durchgeführte Reparaturen / Kosten / Ursache / Ausführender
				<textarea name="reparaturen" rows="3" bind:value={reparaturen}></textarea>
			</label>
		</section>

		<!-- ──────────────────────────── Wetter ──────────────────────────── -->
		<section class="karte">
			<h2>Wetter</h2>
			<div class="tabelle wetter">
				<div class="kopfzeile"><span></span><span>Vormittag</span><span>Nachmittag</span></div>
				{#each WETTERFELDER as feld}
					<div class="datenzeile">
						<span class="beschriftung">{feld.label}</span>
						<input name="vormittag_{feld.id}" bind:value={wetter[`vormittag_${feld.id}`]} />
						<input name="nachmittag_{feld.id}" bind:value={wetter[`nachmittag_${feld.id}`]} />
					</div>
				{/each}
			</div>
			<p class="hilfe">
				Freitext: „3–4", „SW" oder „leicht bewegt" sind genauso gültig wie eine Zahl.
			</p>
		</section>

		<!-- ─────────────────── Maschine, Stunden und Tank ────────────────── -->
		<section class="karte">
			<h2>Maschinen</h2>
			{#each maschinen as m (m.maschineId)}
				{@const d = differenz(m.anfang, m.ende)}
				<div class="maschine">
					<h3>{m.bezeichnung}</h3>
					<input type="hidden" name="maschineId" value={m.maschineId} />
					<input type="hidden" name="maschineBezeichnung" value={m.bezeichnung} />

					<div class="zeile vier">
						<label>
							Angestellt Uhrzeit
							<input type="time" name="maschineAnUhrzeit" bind:value={m.anUhrzeit} />
						</label>
						<label>
							Angestellt Ort
							<input name="maschineAnOrt" bind:value={m.anOrt} />
						</label>
						<label>
							Abgestellt Uhrzeit
							<input type="time" name="maschineAbUhrzeit" bind:value={m.abUhrzeit} />
						</label>
						<label>
							Abgestellt Ort
							<input name="maschineAbOrt" bind:value={m.abOrt} />
						</label>
					</div>

					<div class="zeile drei">
						<label>
							Anfangsstand (Std.)
							<input name="maschineAnfang" bind:value={m.anfang} inputmode="decimal" />
						</label>
						<label>
							Endstand (Std.)
							<input name="maschineEnde" bind:value={m.ende} inputmode="decimal" />
						</label>
						<label>
							Differenz
							<input value={d === null ? '—' : `${d} Std.`} disabled />
						</label>
					</div>
					{#if form?.felder?.[`maschine_${m.maschineId}`]}
						<em>{form.felder[`maschine_${m.maschineId}`]}</em>
					{/if}
				</div>
			{/each}
		</section>

		<section class="karte">
			<h2>Tank</h2>
			<div class="zeile drei">
				<label>
					Tankanzeige Beginn (%)
					<input type="number" name="tankBeginn" bind:value={tankBeginn} min="0" max="100" step="1" />
					{#if form?.felder?.tankBeginn}<em>{form.felder.tankBeginn}</em>{/if}
				</label>
				<label>
					Tankanzeige Ende (%)
					<input type="number" name="tankEnde" bind:value={tankEnde} min="0" max="100" step="1" />
					{#if form?.felder?.tankEnde}<em>{form.felder.tankEnde}</em>{/if}
				</label>
				<label>
					Differenz Anzeige
					<input value={tankDifferenz === null ? '—' : `${tankDifferenz} Prozentpunkte`} disabled />
				</label>
			</div>
			<div class="zeile drei">
				<label>
					Tanknachweis Menge (Liter)
					<input name="getanktLiter" bind:value={getanktLiter} inputmode="decimal" />
				</label>
				<label>
					Betrag (Euro)
					<input name="getanktBetrag" bind:value={getanktBetrag} inputmode="decimal" />
				</label>
				<label>
					Tankort
					<input name="tankort" bind:value={tankort} />
				</label>
			</div>
		</section>

		<!-- ────────────────────────── Besatzung ─────────────────────────── -->
		<section class="karte">
			<h2>Besatzung</h2>
			<div class="tabelle besatzung">
				<div class="kopfzeile">
					<span>Name, Vorname</span><span>Organisation</span><span>Fkt.</span><span>von</span><span
						>bis</span
					><span>Dienstzeit</span><span></span>
				</div>
				{#each besatzung as zeile, i}
					<div class="datenzeile">
						<input bind:value={zeile.name} name="besatzungName" list="mitglieder" placeholder="Nachname, Vorname" />
						<input bind:value={zeile.organisation} name="besatzungOrganisation" placeholder="WW, JUH …" />
						<select bind:value={zeile.funktion} name="besatzungFunktion">
							{#each FUNKTIONEN as f}<option value={f.id}>{f.label}</option>{/each}
						</select>
						<input type="time" bind:value={zeile.von} name="besatzungVon" />
						<input type="time" bind:value={zeile.bis} name="besatzungBis" />
						<input bind:value={zeile.std} name="besatzungStd" inputmode="decimal" placeholder="Std." />
						<button
							type="button"
							class="weg"
							aria-label="Zeile entfernen"
							disabled={besatzung.length <= 1}
							onclick={() => (besatzung = besatzung.filter((_, x) => x !== i))}>×</button
						>
					</div>
				{/each}
			</div>
			<datalist id="mitglieder">
				{#each data.mitgliedernamen as name}<option value={name}></option>{/each}
			</datalist>
			<div class="unter-tabelle">
				<button type="button" class="dazu" onclick={() => (besatzung = [...besatzung, leereBesatzung()])}>
					+ Besatzungsmitglied
				</button>
				<span class="summe">Gesamtdienstzeit: <b>{gesamtdienstzeit} Std.</b></span>
			</div>
		</section>

		<!-- ───────────────────── Grund und Dienstangaben ─────────────────── -->
		<section class="karte">
			<h2>Grund der Fahrt</h2>
			<div class="zeile zwei">
				<label>
					Grund der Fahrt
					<input name="grundDerFahrt" bind:value={grundDerFahrt} />
				</label>
				<label>
					Bereich
					<input name="bereich" bind:value={bereich} />
				</label>
			</div>

			<h3>Dienstangaben</h3>
			<div class="tabelle dienst">
				<div class="kopfzeile">
					<span>Uhrzeit</span><span>Ort</span><span
						>Anlass / Auftrag / Wegpunkte / Bootskennzeichen / Namen</span
					><span></span>
				</div>
				{#each dienstangaben as zeile, i}
					<div class="datenzeile">
						<input type="time" bind:value={zeile.uhrzeit} name="dienstUhrzeit" />
						<input bind:value={zeile.ort} name="dienstOrt" />
						<input bind:value={zeile.anlass} name="dienstAnlass" />
						<button
							type="button"
							class="weg"
							aria-label="Zeile entfernen"
							disabled={dienstangaben.length <= 1}
							onclick={() => (dienstangaben = dienstangaben.filter((_, x) => x !== i))}>×</button
						>
					</div>
				{/each}
			</div>
			<div class="unter-tabelle">
				<button
					type="button"
					class="dazu"
					onclick={() => (dienstangaben = [...dienstangaben, leererDienst()])}
				>
					+ Zeile
				</button>
			</div>
		</section>

		<!-- ─────────────────────── Statistische Werte ────────────────────── -->
		<section class="karte">
			<h2>Statistische Werte</h2>

			<span class="beschriftung">Einsatz alarmiert über</span>
			<div class="haken waagrecht">
				{#each ALARMIERUNG as a}
					<label class="haken-zeile">
						<input
							type="checkbox"
							name="alarmierung"
							value={a.id}
							checked={alarmierung.includes(a.id)}
							onchange={() => (alarmierung = umschalten(alarmierung, a.id))}
						/>
						<span>{a.label}</span>
					</label>
				{/each}
			</div>

			<span class="beschriftung">Einsatzerfolg</span>
			<div class="haken">
				<label class="haken-zeile">
					<input type="checkbox" name="patientUebergeben" bind:checked={patientUebergeben} />
					<span>Patient an bodengebundenen Rettungsdienst übergeben</span>
				</label>
				<div class="haken waagrecht eingerueckt">
					<label class="haken-zeile">
						<input type="checkbox" name="mitNotarzt" bind:checked={mitNotarzt} />
						<span>mit Notarzt</span>
					</label>
					<label class="haken-zeile">
						<input type="checkbox" name="mitReanimation" bind:checked={mitReanimation} />
						<span>mit Reanimation</span>
					</label>
				</div>
			</div>

			<span class="beschriftung">Einsatzart</span>
			<div class="haken">
				{#each EINSATZARTEN as e}
					<label class="haken-zeile">
						<input
							type="checkbox"
							name="einsatzarten"
							value={e.id}
							checked={einsatzarten.includes(e.id)}
							onchange={() => (einsatzarten = umschalten(einsatzarten, e.id))}
						/>
						<span>{e.label}</span>
					</label>
				{/each}
			</div>

			<div class="ja-nein">
				<span>Einsatzprotokoll ausgefüllt und weitergeleitet</span>
				<label><input type="radio" name="einsatzprotokollWeitergeleitet" value="ja" bind:group={einsatzprotokoll} /> ja</label>
				<label><input type="radio" name="einsatzprotokollWeitergeleitet" value="nein" bind:group={einsatzprotokoll} /> nein</label>
			</div>
			<div class="ja-nein">
				<span>Rückmeldung Einsatzauftrag ausgefüllt und weitergeleitet</span>
				<label><input type="radio" name="rueckmeldungWeitergeleitet" value="ja" bind:group={rueckmeldung} /> ja</label>
				<label><input type="radio" name="rueckmeldungWeitergeleitet" value="nein" bind:group={rueckmeldung} /> nein</label>
			</div>
		</section>

		<!-- ───────────────────────── Unterschriften ──────────────────────── -->
		<section class="karte">
			<h2>Unterschriften</h2>
			<div class="zeile zwei">
				<label>
					Bootsführer
					<input name="bootsfuehrerName" bind:value={bootsfuehrerName} list="mitglieder" />
				</label>
				<label>
					Bootssteuerer
					<input name="bootssteuererName" bind:value={bootssteuererName} list="mitglieder" />
				</label>
			</div>
		</section>

		<div class="aktionen">
			<button class="absenden" type="submit" disabled={senden}>
				{senden ? 'Wird gespeichert …' : 'Blatt speichern'}
			</button>
			<button class="zweitrangig" type="submit" formaction="?/unterschreiben" disabled={senden}>
				Als unterschrieben vermerken
			</button>
		</div>
	</form>
</div>

<style>
	.seite {
		min-height: 100vh;
		padding: 32px max(20px, calc((100vw - 1100px) / 2)) 64px;
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
	.karte {
		margin-top: 20px;
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
	.karte h3 {
		margin: 8px 0 0;
		font-size: 12px;
	}
	.hilfe {
		margin: 0;
		color: #888;
		font-size: 11px;
	}
	label,
	.beschriftung {
		display: block;
		font-size: 10px;
		font-weight: 700;
	}
	input,
	select,
	textarea {
		width: 100%;
		margin-top: 7px;
		padding: 0 12px;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
		font: inherit;
		outline: none;
	}
	input,
	select {
		height: 42px;
	}
	textarea {
		padding: 10px 12px;
		resize: vertical;
	}
	input:focus,
	select:focus,
	textarea:focus {
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
	.maschine {
		padding: 16px;
		border: 1px solid #ececea;
		border-radius: 9px;
		display: grid;
		gap: 12px;
	}
	.maschine h3 {
		margin: 0;
		color: #e30613;
		font-size: 12px;
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
	.zeile.vier {
		grid-template-columns: 1fr 1fr 1fr 1fr;
	}

	/* ─── Ankreuzlisten ─── */
	.haken {
		display: grid;
		gap: 4px;
	}
	.haken.waagrecht {
		grid-auto-flow: column;
		justify-content: start;
		gap: 20px;
	}
	.haken.eingerueckt {
		margin-left: 26px;
	}
	.haken-zeile {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 11px;
		font-weight: 400;
		cursor: pointer;
	}
	.haken-zeile input {
		width: 17px;
		height: 17px;
		margin: 0;
		flex: none;
	}

	/* ─── Tabellen ─── */
	.tabelle {
		display: grid;
		gap: 6px;
	}
	.kopfzeile,
	.datenzeile {
		display: grid;
		gap: 8px;
		align-items: center;
	}
	.kopfzeile span {
		color: #888;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}
	.datenzeile input,
	.datenzeile select {
		margin-top: 0;
	}
	.wetter .kopfzeile,
	.wetter .datenzeile {
		grid-template-columns: 130px minmax(0, 1fr) minmax(0, 1fr);
	}
	.wetter .beschriftung {
		font-size: 11px;
	}
	.besatzung .kopfzeile,
	.besatzung .datenzeile {
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) 140px 110px 110px 90px 32px;
	}
	.dienst .kopfzeile,
	.dienst .datenzeile {
		grid-template-columns: 110px minmax(0, 1fr) minmax(0, 2fr) 32px;
	}
	.weg {
		height: 34px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #e30613;
		font-size: 19px;
		cursor: pointer;
	}
	.weg:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}
	.unter-tabelle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.dazu {
		padding: 8px 12px;
		border: 1px dashed #c9c9c8;
		border-radius: 6px;
		background: transparent;
		color: #575756;
		font-size: 10px;
		font-weight: 700;
		cursor: pointer;
	}
	.dazu:hover {
		border-color: #e30613;
		color: #e30613;
	}
	.summe {
		color: #888;
		font-size: 11px;
	}

	.ja-nein {
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 11px;
	}
	.ja-nein > span {
		flex: 1;
	}
	.ja-nein label {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		font-weight: 400;
	}
	.ja-nein input {
		width: 16px;
		height: 16px;
		margin: 0;
	}

	.aktionen {
		margin-top: 20px;
		display: flex;
		gap: 12px;
	}
	.absenden,
	.zweitrangig {
		height: 46px;
		padding: 0 22px;
		border: 0;
		border-radius: 7px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}
	.absenden {
		background: #e30613;
		color: #fff;
	}
	.zweitrangig {
		border: 1px solid #d3d3d0;
		background: #fff;
		color: #575756;
	}
	.absenden:disabled,
	.zweitrangig:disabled {
		opacity: 0.5;
	}

	@media (max-width: 900px) {
		.zeile.zwei,
		.zeile.drei,
		.zeile.vier {
			grid-template-columns: 1fr;
		}
		.haken.waagrecht {
			grid-auto-flow: row;
			gap: 4px;
		}
		.wetter .kopfzeile,
		.besatzung .kopfzeile,
		.dienst .kopfzeile {
			display: none;
		}
		.wetter .datenzeile,
		.besatzung .datenzeile,
		.dienst .datenzeile {
			grid-template-columns: 1fr;
			padding: 12px 0;
			border-bottom: 1px solid #ececea;
		}
		.aktionen {
			flex-direction: column;
		}
	}
	@media (max-width: 600px) {
		.seite {
			padding: 20px 14px 40px;
		}
		.karte {
			padding: 18px;
		}
		header h1 {
			font-size: 25px;
		}
	}
</style>