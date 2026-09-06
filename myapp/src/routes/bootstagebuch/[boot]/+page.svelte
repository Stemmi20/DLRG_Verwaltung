<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const heute = new Date().toISOString().slice(0, 10);

	let liegeort = $state(data.boot.liegeort ?? '');
	let datum = $state(heute);
	let senden = $state(false);

	$effect(() => {
		if (!form?.werte) return;
		liegeort = form.werte.liegeort ?? liegeort;
		datum = form.werte.datum ?? datum;
	});

	function datumText(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>Bootstagebuch</title></svelte:head>

<div class="seite">
	<header>
		<a href="/bootstagebuch">← Alle Boote</a>
		<p>Bootstagebuch</p>
		<h1>{data.boot.funkname}</h1>
		<span>
			{data.blaetter.length} Blätter
			{#each data.maschinen as m (m.id)}
				· {m.bezeichnung}
				{m.betriebsstunden !== null ? `${m.betriebsstunden} Std.` : '—'}
			{/each}
		</span>
	</header>

	{#if form?.fehler}
		<p class="hinweis fehler">{form.fehler}</p>
	{/if}

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
			<h2>Neues Blatt</h2>
			<p class="hilfe">
				Kopf jetzt ausfüllen, alles Weitere trägst du im Laufe des Dienstes direkt im Blatt ein.
			</p>

			<label>
				Liegeort
				<input name="liegeort" bind:value={liegeort} placeholder="z. B. Wache Seestraße" required />
				{#if form?.felder?.liegeort}<em>{form.felder.liegeort}</em>{/if}
			</label>

			<label>
				Datum
				<input type="date" name="datum" bind:value={datum} max={heute} required />
				{#if form?.felder?.datum}<em>{form.felder.datum}</em>{/if}
			</label>

			<button class="absenden" type="submit" disabled={senden}>
				{senden ? 'Wird angelegt …' : 'Blatt anlegen'}
			</button>
		</form>

		<section class="karte">
			<h2>Bisherige Blätter</h2>
			{#if data.blaetter.length === 0}
				<p class="leer">Noch kein Bootstagebuch angelegt.</p>
			{:else}
				<ul>
					{#each data.blaetter as b (b.id)}
						<li>
							<a href="/bootstagebuch/{data.boot.id}/{b.id}">
								<div class="kopf">
									<strong>{datumText(b.datum)}</strong>
									<b class:offen={!b.unterschrieben}>
										{b.unterschrieben ? 'unterschrieben' : 'offen'}
									</b>
								</div>
								<div class="grund">{b.grundDerFahrt || 'Kein Grund eingetragen'}</div>
								<div class="fuss">
									<span>{b.liegeort}</span>
									<span>{b.besatzungAnzahl} Besatzung</span>
									{#if b.bootsfuehrerName}<span>BF {b.bootsfuehrerName}</span>{/if}
								</div>
							</a>
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
	.fehler {
		background: #ffe4e6;
		border-left: 4px solid #e30613;
		color: #be0712;
	}
	.raster {
		margin-top: 20px;
		display: grid;
		grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
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
	.hilfe {
		margin: 0;
		color: #888;
		font-size: 11px;
	}
	label {
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
	}
	li {
		border-bottom: 1px solid #ececea;
	}
	li:last-child {
		border: 0;
	}
	li a {
		display: block;
		padding: 14px 0;
		color: inherit;
		text-decoration: none;
	}
	li a:hover {
		background: #e3061306;
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
		background: #e8f6f0;
		color: #16855b;
		font-size: 10px;
	}
	.kopf b.offen {
		background: #ffed00;
		color: #575756;
	}
	.grund {
		margin-top: 6px;
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
		header h1 {
			font-size: 25px;
		}
	}
</style>