<script lang="ts">
	import { DOKUMENTE, MINDESTALTER, datumDe, type AntragAnsicht } from '$lib/kfausb';

	/** Die Angaben von Seite 1 des Formulars, zum Lesen aufbereitet. */
	let {
		antrag,
		dokumentLink
	}: { antrag: AntragAnsicht; dokumentLink?: (id: string) => string } = $props();

	const p = $derived(antrag.person);

	function groesse(bytes: number): string {
		return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
	}
</script>

<div class="daten">
	<dl>
		<div><dt>Name</dt><dd>{p.vorname} {p.name}</dd></div>
		<div>
			<dt>Geburtsdatum</dt>
			<dd>
				{datumDe(p.geburtsdatum)} · {antrag.alter} Jahre
				{#if antrag.alter < MINDESTALTER}<b class="warnung">unter {MINDESTALTER}</b>{/if}
			</dd>
		</div>
		<div><dt>Einsatzgruppe</dt><dd>{p.einsatzgruppe}</dd></div>
		<div><dt>Anschrift</dt><dd>{p.strasse}, {p.plzOrt}</dd></div>
		<div><dt>Telefon</dt><dd>{p.telefon || '–'}</dd></div>
		<div><dt>Handy</dt><dd>{p.mobil}</dd></div>
		<div><dt>BOS-Sprechfunker am</dt><dd>{datumDe(p.bosAm)}</dd></div>
		<div><dt>Sanitätsausbildung am</dt><dd>{datumDe(p.sanAm)} · {p.sanStufe}</dd></div>
		<div>
			<dt>Führerscheinklassen</dt>
			<dd>{antrag.klassen.map((k) => `${k.klasse} seit ${datumDe(k.seit)}`).join(' · ')}</dd>
		</div>
		<div><dt>Beantragte Fahrzeuge</dt><dd>{antrag.fahrzeuge.join(', ')}</dd></div>
		<div class="ganz">
			<dt>Bestätigung</dt>
			<dd>Mindestens 10.000 km Fahrerfahrung und weniger als 4 Punkte im Fahreignungsregister</dd>
		</div>
	</dl>

	<h3>Nachweise</h3>
	<ul class="dokumente">
		{#each DOKUMENTE as d (d.art)}
			{@const dateien = antrag.dokumente.filter((x) => x.art === d.art)}
			<li>
				<span class="art">{d.label}</span>
				<span class="dateien">
					{#each dateien as datei (datei.id)}
						{#if dokumentLink}
							<a href={dokumentLink(datei.id)} target="_blank" rel="noopener">{datei.name}</a>
						{:else}
							<span>{datei.name}</span>
						{/if}
						<small>{groesse(datei.groesse)}</small>
					{:else}
						<span class="fehlt">nicht hochgeladen</span>
					{/each}
				</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		margin: 0;
		border: 1px solid #e5e5e3;
		border-radius: 9px;
		background: #e5e5e3;
		overflow: hidden;
	}
	dl > div {
		padding: 10px 13px;
		background: #fff;
	}
	dl > div.ganz {
		grid-column: 1 / -1;
	}
	dt {
		color: #888;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.7px;
	}
	dd {
		margin: 3px 0 0;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.warnung {
		margin-left: 6px;
		padding: 2px 7px;
		border-radius: 10px;
		background: #ffe9ea;
		color: #c8000d;
		font-size: 10px;
	}
	h3 {
		margin: 18px 0 8px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}
	.dokumente {
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid #e5e5e3;
		border-radius: 9px;
	}
	.dokumente li {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		gap: 12px;
		padding: 10px 13px;
		border-bottom: 1px solid #ececea;
	}
	.dokumente li:last-child {
		border-bottom: 0;
	}
	.art {
		font-weight: 700;
	}
	.dateien {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
	}
	.dateien a {
		color: #e30613;
		font-weight: 700;
	}
	.dateien small {
		margin-right: 8px;
		color: #999;
	}
	.fehlt {
		color: #c8000d;
	}
	@media (max-width: 700px) {
		dl {
			grid-template-columns: 1fr;
		}
		.dokumente li {
			grid-template-columns: 1fr;
			gap: 3px;
		}
	}
</style>
