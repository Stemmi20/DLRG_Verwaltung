<script lang="ts">
	import { enhance } from '$app/forms';
	import Rahmen from '$lib/components/kfausb/Rahmen.svelte';
	import Einheiten from '$lib/components/kfausb/Einheiten.svelte';
	import {
		DOKUMENTE,
		FAHRZEUGE,
		KLASSEN,
		SAN_STUFEN,
		STATUS_TEXT,
		datumDe,
		heuteISO,
		type Status
	} from '$lib/kfausb';
	import type { ActionData, PageData } from './$types';

	let { data, form: roh }: { data: PageData; form: ActionData } = $props();

	/** Alle Rückmeldungen der Actions in einer Form – nicht jede Action liefert jedes Feld. */
	type Rueckmeldung = {
		fehler?: string;
		felder?: Record<string, string>;
		werte?: Record<string, string>;
		fahrzeuge?: string[];
		klassen?: string[];
		bestaetigt?: boolean;
		eingereicht?: boolean;
		mailOk?: boolean;
	};
	const form = $derived(roh as Rueckmeldung | null | undefined);

	const heute = heuteISO();
	let senden = $state(false);
	let erinnert = $state(false);

	// Was im Formular angehakt ist – steuert, welche Datumsfelder aufklappen.
	let fahrzeuge = $state<string[]>([]);
	let klassen = $state<string[]>([]);
	let dateinamen = $state<Record<string, string[]>>({});

	// Nach einem Fehlversuch die Auswahl wiederherstellen.
	$effect(() => {
		if (form?.fahrzeuge) fahrzeuge = [...form.fahrzeuge];
		if (form?.klassen) klassen = [...form.klassen];
	});

	/** Erst das zuletzt Eingetippte, sonst die Daten aus der Mitgliederverwaltung. */
	function wert(feld: string): string {
		return form?.werte?.[feld] ?? (data.vorlage as unknown as Record<string, string>)[feld] ?? '';
	}
	function fehler(feld: string): string | undefined {
		return form?.felder?.[feld];
	}
	function umschalten(liste: string[], eintrag: string): string[] {
		return liste.includes(eintrag) ? liste.filter((x) => x !== eintrag) : [...liste, eintrag];
	}

	// ─── Statusansicht ───
	const SCHRITTE = ['Antrag eingereicht', 'Befürwortung Ortsgruppe', 'Genehmigung Bezirk', 'Ausbildung', 'Abnahme Bezirk'];
	const REIHENFOLGE: Status[] = ['eingereicht', 'og_befuerwortet', 'in_ausbildung', 'ausbildung_fertig', 'abgeschlossen'];
	const schritt = $derived(data.antrag ? REIHENFOLGE.indexOf(data.antrag.status) + 1 : 0);

	const rueckgabe = $derived(
		data.antrag?.status === 'in_ausbildung'
			? data.antrag.verlauf.find((v) => v.text.startsWith('Zurück in die Ausbildung'))
			: undefined
	);
</script>

<svelte:head><title>Kraftfahrer-Ausbildung | DLRG Friedrichshafen</title></svelte:head>

{#snippet feldfehler(feld: string)}
	{#if fehler(feld)}<em>{fehler(feld)}</em>{/if}
{/snippet}

{#if data.modus === 'abgeschlossen'}
	<Rahmen kopf="Kraftfahrer" titel="Ausbildung abgeschlossen">
		<div class="karte geschafft">
			<i aria-hidden="true">✓</i>
			<div>
				<h2>Du hast die Kraftfahrer-Ausbildung erfolgreich abgeschlossen.</h2>
				{#if data.antrag?.abschluss}
					<p>
						Abgenommen am {datumDe(data.antrag.abschluss.am)} · Fahrberechtigung für
						<b>{data.antrag.abschluss.fahrzeugeErteilt.join(', ')}</b>
					</p>
				{/if}
			</div>
		</div>
		{#if data.istAusbilder}{@render ausbilderListe()}{/if}
	</Rahmen>
{:else if data.modus === 'status' && data.antrag}
	{@const a = data.antrag}
	<Rahmen kopf="Kraftfahrer" titel="Dein Antrag" unterzeile="Eingereicht am {datumDe(a.eingegangenAm)} · {STATUS_TEXT[a.status]}">
		{#if form?.eingereicht}
			<p class="hinweis gut">
				<strong>Antrag eingereicht.</strong>
				{form.mailOk
					? 'Der Leiter Einsatz deiner Ortsgruppe hat eine Mail mit dem Antrag bekommen.'
					: 'Die Mail an die Ortsgruppe konnte gerade nicht verschickt werden. Versuch es unten mit „Erinnerung schicken".'}
			</p>
		{/if}
		{#if erinnert}<p class="hinweis gut">Erinnerung verschickt.</p>{/if}
		{#if form?.fehler}<p class="hinweis schlecht">{form.fehler}</p>{/if}

		<ol class="schritte" aria-label="Fortschritt des Antrags">
			{#each SCHRITTE as titel, i (titel)}
				<li class:erledigt={i < schritt} class:aktuell={i === schritt}>
					<i aria-hidden="true">{i < schritt ? '✓' : i + 1}</i>
					<span>{titel}</span>
					{#if i === 3 && a.status === 'in_ausbildung'}
						<small>{a.fortschritt.erledigt}/{a.fortschritt.gesamt}</small>
					{/if}
				</li>
			{/each}
		</ol>

		<div class="karte">
			<h2>Was noch fehlt</h2>
			{#if a.status === 'eingereicht'}
				<p class="offen">Der Leiter Einsatz deiner Ortsgruppe muss den Antrag befürworten.</p>
			{:else if a.status === 'og_befuerwortet'}
				<p class="offen">Die Leitung Einsatz im Bezirk muss die Ausbildung genehmigen.</p>
			{:else if a.status === 'in_ausbildung'}
				{#if rueckgabe}
					<p class="hinweis warten">
						<strong>Der Bezirk hat die Ausbildung zurückgegeben ({datumDe(rueckgabe.am)}).</strong>
						{rueckgabe.text.replace('Zurück in die Ausbildung: ', '')}
					</p>
				{/if}
				<p class="offen">
					Noch <b>{a.fortschritt.gesamt - a.fortschritt.erledigt}</b> von {a.fortschritt.gesamt}
					Einheiten offen – mindestens <b>{a.fortschritt.ueOffen} UE</b>. Die Einheiten zeichnen die
					Kraftfahrer-Ausbilder ab.
				</p>
				<div class="balken" aria-hidden="true">
					<span style="width: {(a.fortschritt.erledigt / a.fortschritt.gesamt) * 100}%"></span>
				</div>
			{:else if a.status === 'ausbildung_fertig'}
				<p class="offen">
					Alle Einheiten sind erbracht. Die Leitung Einsatz im Bezirk muss die Ausbildung noch
					abnehmen.
				</p>
			{/if}

			{#if a.wartetAuf}
				<form
					method="POST"
					action="?/erinnern"
					class="erinnern"
					use:enhance={() => {
						erinnert = false;
						return async ({ result, update }) => {
							if (result.type === 'success') erinnert = true;
							await update();
						};
					}}
				>
					<button class="knopf" disabled={a.erinnerungAb !== null}>Erinnerung schicken</button>
					<small>
						{a.erinnerungAb
							? `Wieder möglich ab ${new Date(a.erinnerungAb).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
							: 'Schickt den Link noch einmal per Mail.'}
					</small>
				</form>
			{/if}
		</div>

		{#if a.status === 'in_ausbildung' || a.status === 'ausbildung_fertig'}
			<div class="karte">
				<h2>
					Ausbildungsnachweis
					<small>{a.fortschritt.ueIst} von mindestens {a.fortschritt.ueSoll} UE erbracht</small>
				</h2>
				<Einheiten einheiten={a.fortschritt.einheiten} />
			</div>
		{/if}

		<div class="karte">
			<h2>Verlauf</h2>
			<ul class="verlauf">
				{#each a.verlauf as v, i (i)}
					<li><time>{datumDe(v.am)}</time><span>{v.text}</span></li>
				{/each}
			</ul>
		</div>

		{#if data.istAusbilder}{@render ausbilderListe()}{/if}
	</Rahmen>
{:else}
	<Rahmen
		kopf="Kraftfahrer"
		titel="Kraftfahrer-Ausbildung beantragen"
		unterzeile="Antrag auf Fahrberechtigung, Bezirk Bodenseekreis. Was schon in der Mitgliederverwaltung steht, ist vorausgefüllt – bitte prüfen."
	>
		{#if data.antrag?.status === 'abgelehnt'}
			<p class="hinweis schlecht">
				<strong>Dein letzter Antrag wurde abgelehnt.</strong>
				{data.antrag.verlauf[0]?.text} ({datumDe(data.antrag.verlauf[0]?.am)}). Du kannst einen neuen
				Antrag stellen.
			</p>
		{/if}
		{#if form?.fehler}<p class="hinweis schlecht">{form.fehler}</p>{/if}

		<form
			method="POST"
			action="?/beantragen"
			enctype="multipart/form-data"
			class="stapel"
			use:enhance={() => {
				senden = true;
				return async ({ update }) => {
					await update({ reset: false });
					senden = false;
				};
			}}
		>
			<section class="karte">
				<h2>Angaben zur Person</h2>
				<div class="raster">
					<label class="feld">
						Name
						<input name="name" value={wert('name')} autocomplete="family-name" required aria-invalid={!!fehler('name')} />
						{@render feldfehler('name')}
					</label>
					<label class="feld">
						Vorname
						<input name="vorname" value={wert('vorname')} autocomplete="given-name" required aria-invalid={!!fehler('vorname')} />
						{@render feldfehler('vorname')}
					</label>
					<label class="feld">
						Geburtsdatum
						<input type="date" name="geburtsdatum" value={wert('geburtsdatum')} max={heute} required aria-invalid={!!fehler('geburtsdatum')} />
						{@render feldfehler('geburtsdatum')}
					</label>
					<label class="feld">
						Einsatzgruppe
						<input name="einsatzgruppe" value={wert('einsatzgruppe')} required aria-invalid={!!fehler('einsatzgruppe')} />
						{@render feldfehler('einsatzgruppe')}
					</label>
					<label class="feld">
						Straße, Nr.
						<input name="strasse" value={wert('strasse')} autocomplete="street-address" required aria-invalid={!!fehler('strasse')} />
						{@render feldfehler('strasse')}
					</label>
					<label class="feld">
						PLZ, Ort
						<input name="plzOrt" value={wert('plzOrt')} required aria-invalid={!!fehler('plzOrt')} />
						{@render feldfehler('plzOrt')}
					</label>
					<label class="feld">
						Telefon <span class="optional">optional</span>
						<input type="tel" name="telefon" value={wert('telefon')} autocomplete="tel" />
					</label>
					<label class="feld">
						Handy
						<input type="tel" name="mobil" value={wert('mobil')} autocomplete="tel" required aria-invalid={!!fehler('mobil')} />
						{@render feldfehler('mobil')}
					</label>
				</div>
			</section>

			<section class="karte">
				<h2>Qualifikationen</h2>
				<div class="raster">
					<label class="feld">
						BOS-Sprechfunker am
						<input type="date" name="bosAm" value={wert('bosAm')} max={heute} required aria-invalid={!!fehler('bosAm')} />
						{@render feldfehler('bosAm')}
					</label>
					<div class="raster innen">
						<label class="feld">
							Sanitätsausbildung am
							<input type="date" name="sanAm" value={wert('sanAm')} max={heute} required aria-invalid={!!fehler('sanAm')} />
							{@render feldfehler('sanAm')}
						</label>
						<label class="feld">
							Stufe
							<select name="sanStufe" value={wert('sanStufe')}>
								{#each SAN_STUFEN as stufe (stufe)}<option>{stufe}</option>{/each}
							</select>
							{@render feldfehler('sanStufe')}
						</label>
					</div>
				</div>
			</section>

			<section class="karte">
				<h2>Führerscheinklassen <small>Jede Klasse ankreuzen, die du besitzt, und angeben, seit wann.</small></h2>
				<div class="klassen">
					{#each KLASSEN as k (k)}
						{@const aktiv = klassen.includes(k)}
						<div class="klasse" class:aktiv>
							<label class="wahl">
								<input type="checkbox" name="klasse" value={k} checked={aktiv} onchange={() => (klassen = umschalten(klassen, k))} />
								<b>{k}</b>
							</label>
							{#if aktiv}
								<label class="feld">
									seit
									<input type="date" name="seit_{k}" value={wert(`seit_${k}`)} max={heute} required aria-invalid={!!fehler(`seit_${k}`)} />
									{@render feldfehler(`seit_${k}`)}
								</label>
							{/if}
						</div>
					{/each}
				</div>
				{#if fehler('klassen')}<em class="fehlertext">{fehler('klassen')}</em>{/if}
			</section>

			<section class="karte">
				<h2>Fahrberechtigung beantragen für <small>Für jedes gewählte Fahrzeug gehören vier Fahreinheiten zur Ausbildung.</small></h2>
				<div class="chips">
					{#each FAHRZEUGE as f (f)}
						<label class="chip" class:aktiv={fahrzeuge.includes(f)}>
							<input type="checkbox" name="fahrzeug" value={f} checked={fahrzeuge.includes(f)} onchange={() => (fahrzeuge = umschalten(fahrzeuge, f))} />
							{f}
						</label>
					{/each}
				</div>
				{#if fehler('fahrzeuge')}<em class="fehlertext">{fehler('fahrzeuge')}</em>{/if}
			</section>

			<section class="karte">
				<h2>Nachweise <small>Kopien als JPG, PNG oder PDF, je Datei höchstens 5 MB. Die Dateien sehen nur Ortsgruppe und Bezirk.</small></h2>
				<div class="dokumente">
					{#each DOKUMENTE as d (d.art)}
						<div class="dokument" class:gewaehlt={dateinamen[d.art]?.length}>
							<div>
								<b>{d.label}</b>
								<small>{d.hinweis}</small>
								{#if dateinamen[d.art]?.length}
									<span class="namen">{dateinamen[d.art].join(', ')}</span>
								{/if}
								{@render feldfehler(`dok_${d.art}`)}
							</div>
							<label class="knopf">
								{dateinamen[d.art]?.length ? 'Andere wählen' : 'Datei wählen'}
								<input
									class="versteckt"
									type="file"
									name="dok_{d.art}"
									multiple
									accept="image/jpeg,image/png,application/pdf"
									onchange={(e) => (dateinamen[d.art] = [...(e.currentTarget.files ?? [])].map((f) => f.name))}
								/>
							</label>
						</div>
					{/each}
				</div>
				{#if fehler('dokumente')}<em class="fehlertext">{fehler('dokumente')}</em>{/if}
			</section>

			<section class="karte abschluss">
				<label class="bestaetigung" class:fehlt={fehler('bestaetigung')}>
					<input type="checkbox" name="bestaetigung" value="ja" checked={form?.bestaetigt ?? false} required />
					<span>
						Ich bestätige, dass ich mindestens <b>10.000 Kilometer</b> Erfahrung im Fahren eines Kfz und
						<b>weniger als 4 Punkte</b> im Fahreignungsregister habe.
					</span>
				</label>
				{@render feldfehler('bestaetigung')}
				<button class="knopf rot gross" disabled={senden}>
					{senden ? 'Wird eingereicht …' : 'Antrag einreichen'}
				</button>
			</section>
		</form>

		{#if data.istAusbilder}{@render ausbilderListe()}{/if}
	</Rahmen>
{/if}

{#snippet ausbilderListe()}
	<section class="karte ausbilder">
		<h2>Als Ausbilder <small>Laufende Ausbildungen, in denen du Einheiten abzeichnen kannst.</small></h2>
		{#if data.ausbildungen.length === 0}
			<p class="leer">Gerade läuft keine Ausbildung.</p>
		{:else}
			<ul>
				{#each data.ausbildungen as a (a.id)}
					<li>
						<a href="/kfausb/ausbildung/{a.id}">
							<span class="wer">
								<b>{a.name}</b>
								<small>{a.einsatzgruppe} · {a.fahrzeuge.join(', ')}</small>
							</span>
							<span class="stand">
								{#if a.status === 'ausbildung_fertig'}
									<em class="fertig">wartet auf Abnahme</em>
								{:else}
									<em>{a.erledigt}/{a.gesamt} · noch {a.ueOffen} UE</em>
								{/if}
								<span class="balken klein"><span style="width: {(a.erledigt / a.gesamt) * 100}%"></span></span>
							</span>
							<i aria-hidden="true">›</i>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

<style>
	.optional {
		margin-left: 4px;
		color: #999;
		font-weight: 400;
	}
	.raster.innen {
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	/* Führerscheinklassen */
	.klassen {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.klasse {
		padding: 10px 12px;
		border: 1px solid #e0e0de;
		border-radius: 9px;
	}
	.klasse.aktiv {
		border-color: #e30613;
		background: #e3061306;
	}
	.wahl {
		display: flex;
		align-items: center;
		gap: 9px;
		cursor: pointer;
		font-size: 15px;
	}
	.wahl input,
	.bestaetigung input {
		width: 18px;
		height: 18px;
		accent-color: #e30613;
	}
	.klasse .feld {
		margin-top: 8px;
	}

	/* Fahrzeuge */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
	}
	.chip {
		position: relative;
		padding: 11px 18px;
		border: 1px solid #d3d3d0;
		border-radius: 30px;
		background: #fff;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}
	.chip input {
		position: absolute;
		opacity: 0;
	}
	.chip.aktiv {
		border-color: #e30613;
		background: #e30613;
		color: #fff;
	}
	.chip:focus-within {
		outline: 2px solid #575756;
		outline-offset: 2px;
	}

	/* Dokumente */
	.dokumente {
		display: grid;
		gap: 10px;
	}
	.dokument {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 12px 14px;
		border: 1px dashed #c9c9c8;
		border-radius: 9px;
	}
	.dokument.gewaehlt {
		border-style: solid;
		border-color: #16855b;
		background: #f4faf7;
	}
	.dokument b,
	.dokument small,
	.dokument .namen {
		display: block;
	}
	.dokument small {
		color: #888;
	}
	.dokument .namen {
		margin-top: 4px;
		color: #16855b;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.dokument .knopf {
		flex: none;
	}
	.versteckt {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.dokument .knopf:focus-within {
		outline: 2px solid #575756;
		outline-offset: 2px;
	}

	/* Bestätigung und Absenden */
	.abschluss {
		display: grid;
		gap: 16px;
		justify-items: start;
	}
	.bestaetigung {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 14px 16px;
		border-left: 4px solid #ffed00;
		border-radius: 8px;
		background: #fffbd6;
		font-size: 14px;
		cursor: pointer;
	}
	.bestaetigung.fehlt {
		border-color: #e30613;
	}
	.bestaetigung input {
		margin-top: 2px;
		flex: none;
	}
	.knopf.gross {
		min-height: 50px;
		padding: 0 28px;
		font-size: 15px;
	}

	/* Status */
	.schritte {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
		margin: 0 0 18px;
		padding: 0;
		list-style: none;
	}
	.schritte li {
		position: relative;
		padding: 12px 10px;
		border-radius: 10px;
		background: #ffffff80;
		color: #999;
		text-align: center;
	}
	.schritte li i {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		margin: 0 auto 6px;
		border-radius: 50%;
		background: #e5e5e3;
		color: #888;
		font-style: normal;
		font-weight: 700;
	}
	.schritte li span {
		display: block;
		font-size: 11px;
		font-weight: 700;
	}
	.schritte li small {
		display: block;
		margin-top: 2px;
		font-size: 11px;
	}
	.schritte li.erledigt {
		color: #16855b;
	}
	.schritte li.erledigt i {
		background: #16855b;
		color: #fff;
	}
	.schritte li.aktuell {
		background: #fff;
		color: #575756;
		box-shadow: 0 6px 18px #57575618;
	}
	.schritte li.aktuell i {
		background: #e30613;
		color: #ffed00;
	}
	.offen {
		margin: 0 0 12px;
		font-size: 14px;
	}
	.balken {
		height: 8px;
		border-radius: 8px;
		background: #ececea;
		overflow: hidden;
	}
	.balken span {
		display: block;
		height: 100%;
		background: #16855b;
	}
	.balken.klein {
		display: block;
		width: 110px;
		height: 5px;
		margin-top: 5px;
	}
	.erinnern {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid #ececea;
	}
	.erinnern small {
		color: #888;
	}
	.verlauf {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.verlauf li {
		display: grid;
		grid-template-columns: 90px minmax(0, 1fr);
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid #f0f0ee;
	}
	.verlauf li:last-child {
		border-bottom: 0;
	}
	.verlauf time {
		color: #888;
	}

	/* Abgeschlossen */
	.geschafft {
		display: flex;
		align-items: center;
		gap: 20px;
		border-top: 6px solid #16855b;
	}
	.geschafft > i {
		display: grid;
		flex: none;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: #16855b;
		color: #fff;
		font-size: 30px;
		font-style: normal;
	}
	.geschafft h2 {
		margin: 0;
		padding: 0;
		border: 0;
		font-size: 20px;
	}
	.geschafft p {
		margin: 6px 0 0;
	}

	/* Ausbilder */
	.ausbilder ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid #e5e5e3;
		border-radius: 9px;
		overflow: hidden;
	}
	.ausbilder li + li {
		border-top: 1px solid #ececea;
	}
	.ausbilder a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 14px;
		gap: 14px;
		align-items: center;
		padding: 12px 14px;
		color: inherit;
		text-decoration: none;
	}
	.ausbilder a:hover {
		background: #fafafa;
	}
	.wer b,
	.wer small {
		display: block;
	}
	.wer small {
		color: #888;
	}
	.ausbilder em {
		font-style: normal;
		font-weight: 700;
	}
	.ausbilder em.fertig {
		color: #16855b;
	}
	.ausbilder i {
		color: #e30613;
		font-size: 20px;
		font-style: normal;
	}

	@media (max-width: 800px) {
		.schritte {
			grid-template-columns: 1fr;
		}
		.schritte li {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 8px 12px;
			text-align: left;
		}
		.schritte li i {
			margin: 0;
		}
		.klassen {
			grid-template-columns: 1fr 1fr;
		}
		.dokument {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
