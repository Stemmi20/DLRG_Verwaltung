<script lang="ts">
	import { page } from '$app/state';
	import { MENUE, istAktiv } from '$lib/navigation';
	import NavIcon from './NavIcon.svelte';

	/*
	 * Navigationsleiste links, auf jeder Seite.
	 *  - Breit (ab 900 px): ein- und ausklappbar; eingeklappt bleiben nur die Icons.
	 *    Der Zustand steht in einem Cookie, damit die Seite beim Laden gleich
	 *    richtig aussieht und nichts springt.
	 *  - Schmal: ausgeblendet, ein Knopf unten links öffnet sie als Schublade.
	 */
	let {
		zu = $bindable(false),
		user,
	}: {
		zu?: boolean;
		user: { vorname: string; nachname: string } | null;
	} = $props();

	const name = $derived(user ? `${user.vorname} ${user.nachname}`.trim() : '');
	const initialen = $derived(user ? `${user.vorname[0] ?? ''}${user.nachname[0] ?? ''}` : '');

	let mobilOffen = $state(false);
	const pfad = $derived(page.url.pathname);

	function umschalten() {
		zu = !zu;
		document.cookie = `seitenleiste=${zu ? 'zu' : 'auf'}; path=/; max-age=31536000; samesite=lax`;
	}

	// Nach jedem Seitenwechsel die Schublade auf dem Handy wieder schließen.
	$effect(() => {
		void pfad;
		mobilOffen = false;
	});

	// ─── Abmelden ───
	let meldetAb = $state(false);
	async function abmelden() {
		meldetAb = true;
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	// ─── Fehler melden ───
	let dialog: HTMLDialogElement | undefined = $state();
	let sendet = $state(false);
	let gesendet = $state(false);
	let meldungFehler = $state('');

	function meldenOeffnen() {
		gesendet = false;
		meldungFehler = '';
		mobilOffen = false;
		dialog?.showModal();
	}

	async function meldungSenden(e: SubmitEvent) {
		e.preventDefault();
		const formular = e.currentTarget as HTMLFormElement;
		sendet = true;
		meldungFehler = '';
		try {
			const antwort = await fetch('/api/fehlermeldung', { method: 'POST', body: new FormData(formular) });
			const daten = (await antwort.json().catch(() => ({}))) as { ok?: boolean; fehler?: string };
			if (antwort.ok && daten.ok) {
				gesendet = true;
				formular.reset();
			} else {
				meldungFehler = daten.fehler ?? 'Die Meldung konnte nicht verschickt werden.';
			}
		} catch {
			meldungFehler = 'Keine Verbindung zum Server.';
		} finally {
			sendet = false;
		}
	}

	/*
	 * Die Leiste beginnt unter der roten Kopfleiste. Damit „Abmelden" unten
	 * immer sichtbar ist, ist sie genau so hoch wie der freie Platz darunter –
	 * beim Scrollen wächst sie mit, bis die Kopfleiste ganz weg ist.
	 */
	let aside: HTMLElement | undefined = $state();
	let oben = $state<number | null>(null);
	$effect(() => {
		const messen = () => {
			const t = aside?.parentElement?.getBoundingClientRect().top ?? 0;
			oben = Math.max(0, t);
		};
		messen();
		window.addEventListener('scroll', messen, { passive: true });
		window.addEventListener('resize', messen);
		return () => {
			window.removeEventListener('scroll', messen);
			window.removeEventListener('resize', messen);
		};
	});

	function taste(e: KeyboardEvent) {
		if (e.key === 'Escape' && mobilOffen) mobilOffen = false;
	}
</script>

<svelte:window onkeydown={taste} />

<button
	class="mobil-knopf"
	onclick={() => (mobilOffen = true)}
	aria-label="Navigation öffnen"
	aria-expanded={mobilOffen}
	aria-controls="seitenleiste"
>
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d="M4 7h16M4 12h16M4 17h16" />
	</svg>
	<span>Menü</span>
</button>

{#if mobilOffen}
	<button class="abdunkeln" aria-label="Navigation schließen" onclick={() => (mobilOffen = false)}></button>
{/if}

<aside
	bind:this={aside}
	id="seitenleiste"
	class="leiste"
	class:zu
	class:mobil-offen={mobilOffen}
	style:--oben={oben === null ? null : `${oben}px`}
	aria-label="Hauptnavigation"
>
	<div class="kopf">
		<a href="/" class="punkt start" class:aktiv={pfad === '/'} aria-current={pfad === '/' ? 'page' : undefined} title={zu ? 'Startseite' : undefined}>
			<span class="icon"><NavIcon name="start" /></span>
			<span class="text">Startseite</span>
		</a>
		<button class="einklappen" onclick={umschalten} aria-label={zu ? 'Navigation ausklappen' : 'Navigation einklappen'} title={zu ? 'Ausklappen' : 'Einklappen'}>
			<span class="pfeil" class:rechts={zu}><NavIcon name="pfeil" groesse={18} /></span>
		</button>
		<button class="schliessen" onclick={() => (mobilOffen = false)} aria-label="Navigation schließen">✕</button>
	</div>

	<nav class="liste">
		{#each MENUE as bereich (bereich.titel)}
			<section class="bereich farbe-{bereich.farbe}">
				<h2><span>{bereich.titel}</span></h2>
				<ul>
					{#each bereich.punkte as p (p.titel)}
						<li>
							{#if p.href}
								<a
									href={p.href}
									class="punkt"
									class:aktiv={istAktiv(p.href, pfad)}
									aria-current={istAktiv(p.href, pfad) ? 'page' : undefined}
									title={zu ? p.titel : undefined}
								>
									<span class="icon"><NavIcon name={p.icon} /></span>
									<span class="text">{p.titel}</span>
								</a>
							{:else}
								<span class="punkt gesperrt" title={zu ? `${p.titel} (kommt noch)` : 'Kommt noch'} aria-disabled="true">
									<span class="icon"><NavIcon name={p.icon} /></span>
									<span class="text">{p.titel}<small>bald</small></span>
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</nav>

	<div class="fuss">
		{#if user}
			<p class="wer" title={name}>{zu ? initialen : name}</p>
		{/if}
		<button class="punkt knopf" onclick={meldenOeffnen} title={zu ? 'Fehler melden' : undefined}>
			<span class="icon"><NavIcon name="kaefer" /></span>
			<span class="text">Fehler melden</span>
		</button>
		<button class="punkt knopf abmelden" onclick={abmelden} disabled={meldetAb} title={zu ? 'Abmelden' : undefined}>
			<span class="icon"><NavIcon name="abmelden" /></span>
			<span class="text">{meldetAb ? 'Wird abgemeldet …' : 'Abmelden'}</span>
		</button>
	</div>
</aside>

<dialog bind:this={dialog} class="melden" aria-labelledby="melden-titel">
	{#if gesendet}
		<div class="danke">
			<h2 id="melden-titel">Danke!</h2>
			<p>Deine Meldung ist beim IT-Team angekommen.</p>
			<button class="senden" onclick={() => dialog?.close()}>Schließen</button>
		</div>
	{:else}
		<form onsubmit={meldungSenden}>
			<div class="dialog-kopf">
				<h2 id="melden-titel">Fehler melden</h2>
				<button type="button" class="zu-knopf" onclick={() => dialog?.close()} aria-label="Schließen">✕</button>
			</div>

			<fieldset class="arten">
				<legend>Worum geht es?</legend>
				<label><input type="radio" name="art" value="fehler" checked /><span>Fehler</span></label>
				<label><input type="radio" name="art" value="idee" /><span>Verbesserung</span></label>
				<label><input type="radio" name="art" value="frage" /><span>Frage</span></label>
			</fieldset>

			<label class="feld">
				<span>Titel</span>
				<input name="titel" required maxlength="120" placeholder="z. B. Karte lädt im Flottenmanager nicht" />
			</label>
			<label class="feld">
				<span>Beschreibung</span>
				<textarea
					name="beschreibung"
					required
					minlength="10"
					maxlength="5000"
					rows="5"
					placeholder="Was hast du gemacht, was ist passiert, und was hättest du erwartet?"
				></textarea>
			</label>
			<label class="feld">
				<span>Screenshot <small>optional, PNG/JPG bis 5 MB</small></span>
				<input name="bild" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
			</label>
			<label class="feld">
				<span>Rückmeldung an <small>optional, deine E-Mail</small></span>
				<input name="antwortAn" type="email" maxlength="200" placeholder="vorname.nachname@…" />
			</label>

			<input type="hidden" name="seite" value={page.url.pathname + page.url.search} />
			<p class="hinweis">Die aktuelle Seite ({page.url.pathname}) und dein Browser werden automatisch mitgeschickt.</p>

			{#if meldungFehler}<p class="fehler" role="alert">{meldungFehler}</p>{/if}

			<div class="dialog-fuss">
				<button type="button" class="abbrechen" onclick={() => dialog?.close()}>Abbrechen</button>
				<button class="senden" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Absenden'}</button>
			</div>
		</form>
	{/if}
</dialog>

<style>
	.leiste {
		--breite: 15.5rem;
		--nacht: #0b1014;
		--stahl: #16202a;
		--kante: #243342;
		--eis: #e6edf2;
		--grau: #8a9aa8;

		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		flex: none;
		width: var(--breite);
		/* Vor dem ersten Messen (Server) die Höhe der Kopfleiste annehmen. */
		height: calc(100dvh - var(--oben, var(--navbar-hoehe, 0px)));
		border-right: 1px solid var(--kante);
		background: var(--nacht);
		color: var(--eis);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		transition: width 0.18s ease;
	}
	.leiste.zu {
		--breite: 4rem;
	}

	/* ─── Kopf: Startseite + Einklappen ─── */
	.kopf {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px 8px;
		border-bottom: 1px solid var(--kante);
	}
	.kopf .start {
		flex: 1;
		min-width: 0;
	}
	.zu .kopf {
		flex-direction: column-reverse;
		gap: 6px;
	}
	.einklappen,
	.schliessen {
		display: grid;
		place-items: center;
		flex: none;
		width: 36px;
		height: 36px;
		border: 1px solid var(--kante);
		border-radius: 8px;
		background: var(--stahl);
		color: var(--grau);
		cursor: pointer;
	}
	.einklappen:hover,
	.schliessen:hover {
		color: var(--eis);
	}
	.pfeil {
		display: grid;
		transition: transform 0.18s ease;
	}
	.pfeil.rechts {
		transform: rotate(180deg);
	}
	.schliessen {
		display: none;
		font-size: 16px;
	}

	/* ─── Liste ─── */
	.liste {
		flex: 1;
		padding: 6px 8px 24px;
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.bereich {
		--farbe: var(--grau);
		margin-top: 10px;
	}
	.farbe-rot {
		--farbe: #e30613;
	}
	.farbe-blau {
		--farbe: #0090d4;
	}
	.farbe-gruen {
		--farbe: #35b27a;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 4px;
		padding: 0 10px;
		color: var(--grau);
		font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2::before {
		content: '';
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--farbe);
	}
	/* Eingeklappt: statt Überschrift nur ein farbiger Strich. */
	.zu h2 {
		justify-content: center;
		height: 10px;
		padding: 0;
	}
	.zu h2::before {
		width: 24px;
		height: 3px;
	}
	.zu h2 span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	ul {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.punkt {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 42px;
		padding: 0 10px;
		border-radius: 8px;
		color: var(--eis);
		font-size: 14.5px;
		text-decoration: none;
		white-space: nowrap;
	}
	.punkt:hover:not(.gesperrt) {
		background: var(--stahl);
	}
	.punkt:focus-visible,
	.einklappen:focus-visible,
	.mobil-knopf:focus-visible {
		outline: 3px solid #0090d4;
		outline-offset: -3px;
	}
	.punkt.aktiv {
		background: var(--stahl);
		font-weight: 600;
	}
	.punkt.aktiv::before {
		content: '';
		position: absolute;
		left: -8px;
		top: 8px;
		bottom: 8px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--farbe, #ffdd00);
	}
	.start.aktiv::before {
		background: #ffdd00;
	}
	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 24px;
		color: var(--grau);
	}
	.aktiv .icon {
		color: var(--farbe, #ffdd00);
	}
	.start.aktiv .icon {
		color: #ffdd00;
	}
	.text {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.gesperrt {
		color: #5d6b78;
		cursor: not-allowed;
	}
	.gesperrt .icon {
		color: #44515d;
	}
	.gesperrt small {
		padding: 0 6px;
		border: 1px solid var(--kante);
		border-radius: 999px;
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.zu .punkt {
		justify-content: center;
		padding: 0;
	}
	.zu .text {
		display: none;
	}

	/* ─── Fuß: Name, Fehler melden, Abmelden ─── */
	.fuss {
		display: grid;
		gap: 2px;
		padding: 8px;
		border-top: 1px solid var(--kante);
	}
	.wer {
		margin: 0;
		padding: 4px 10px 6px;
		overflow: hidden;
		color: var(--grau);
		font-size: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.zu .wer {
		padding: 4px 0 6px;
		text-align: center;
		font-weight: 600;
	}
	.knopf {
		width: 100%;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 14.5px;
		cursor: pointer;
	}
	.knopf:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.knopf:focus-visible {
		outline: 3px solid #0090d4;
		outline-offset: -3px;
	}
	.abmelden:hover:not(:disabled) .icon,
	.abmelden:hover:not(:disabled) .text {
		color: #ff6b73;
	}

	/* ─── Dialog „Fehler melden" ─── */
	.melden {
		width: min(34rem, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 1px solid #243342;
		border-radius: 14px;
		background: #16202a;
		color: #e6edf2;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		color-scheme: dark;
		box-shadow: 0 24px 60px #000a;
	}
	.melden::backdrop {
		background: #000a;
	}
	.melden form,
	.danke {
		display: grid;
		gap: 14px;
		padding: 20px 22px 22px;
	}
	.dialog-kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.melden h2 {
		margin: 0;
		font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
		font-size: 26px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.zu-knopf {
		width: 36px;
		height: 36px;
		border: 1px solid #243342;
		border-radius: 8px;
		background: transparent;
		color: #8a9aa8;
		cursor: pointer;
	}
	.arten {
		display: flex;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.arten legend {
		margin-bottom: 6px;
		padding: 0;
		color: #8a9aa8;
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.arten label {
		flex: 1;
	}
	.arten input {
		position: absolute;
		opacity: 0;
	}
	.arten span {
		display: block;
		padding: 9px 6px;
		border: 1px solid #243342;
		border-radius: 8px;
		text-align: center;
		font-size: 14px;
		cursor: pointer;
	}
	.arten input:checked + span {
		border-color: #e30613;
		background: #e3061322;
		font-weight: 600;
	}
	.arten input:focus-visible + span {
		outline: 3px solid #0090d4;
		outline-offset: 2px;
	}
	.feld {
		display: grid;
		gap: 6px;
	}
	.feld > span {
		color: #8a9aa8;
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.feld small {
		letter-spacing: 0;
		text-transform: none;
	}
	.feld input,
	.feld textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #243342;
		border-radius: 8px;
		background: #0b1014;
		color: #e6edf2;
		font: inherit;
		font-size: 15px;
	}
	.feld textarea {
		resize: vertical;
	}
	.feld input:focus,
	.feld textarea:focus {
		border-color: #0090d4;
		outline: none;
	}
	.feld input[type='file'] {
		padding: 8px;
		font-size: 13px;
	}
	.hinweis {
		margin: 0;
		color: #8a9aa8;
		font-size: 12px;
	}
	.fehler {
		margin: 0;
		color: #ff6b73;
		font-size: 14px;
	}
	.dialog-fuss {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.abbrechen,
	.senden {
		min-height: 44px;
		padding: 0 18px;
		border: 1px solid #243342;
		border-radius: 8px;
		background: transparent;
		color: #e6edf2;
		font: 600 17px 'Barlow Condensed', 'Arial Narrow', sans-serif;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.senden {
		border-color: #e30613;
		background: #e30613;
	}
	.senden:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.danke p {
		margin: 0;
	}
	.danke .senden {
		justify-self: end;
	}

	/* ─── Handy: Schublade ─── */
	.mobil-knopf,
	.abdunkeln {
		display: none;
	}
	@media (max-width: 899px) {
		.leiste,
		.leiste.zu {
			--breite: min(18rem, 86vw);
			position: fixed;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: 2000; /* über Leaflet-Karten (bis 1000) */
			height: auto;
			box-shadow: 8px 0 30px #0008;
			transform: translateX(-105%);
			transition: transform 0.2s ease;
		}
		.leiste.mobil-offen {
			transform: none;
		}
		/* In der Schublade immer ausgeklappt. */
		.zu .text {
			display: flex;
		}
		.zu .punkt {
			justify-content: flex-start;
			padding: 0 10px;
		}
		.zu h2 {
			justify-content: flex-start;
			height: auto;
			padding: 0 10px;
		}
		.zu h2::before {
			width: 8px;
			height: 8px;
		}
		.zu h2 span {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
		}
		.zu .kopf {
			flex-direction: row;
		}
		.einklappen {
			display: none;
		}
		.zu .wer {
			padding: 4px 10px 6px;
			text-align: left;
			font-weight: 400;
		}
		.schliessen {
			display: grid;
		}
		.mobil-knopf {
			position: fixed;
			left: 14px;
			bottom: 14px;
			z-index: 1900;
			display: flex;
			align-items: center;
			gap: 8px;
			height: 48px;
			padding: 0 16px 0 13px;
			border: 1px solid #243342;
			border-radius: 999px;
			background: #16202a;
			color: #e6edf2;
			font: 600 15px 'Barlow Condensed', 'Arial Narrow', sans-serif;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			box-shadow: 0 6px 20px #0007;
			cursor: pointer;
		}
		.abdunkeln {
			position: fixed;
			inset: 0;
			z-index: 1950;
			display: block;
			border: 0;
			background: #0009;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.leiste,
		.pfeil {
			transition: none;
		}
	}
</style>
