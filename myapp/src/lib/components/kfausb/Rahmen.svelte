<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * Gemeinsamer Rahmen der Kraftfahrer-Seiten. Die Grundstile (Karten, Felder,
	 * Knöpfe, Hinweise) gelten für alles innerhalb von .kf – so sehen Antrag,
	 * Ausbilderseite und Prüfseite gleich aus, ohne dass jede Seite sie kopiert.
	 */
	let {
		kopf,
		titel,
		unterzeile = '',
		children
	}: { kopf: string; titel: string; unterzeile?: string; children: Snippet } = $props();
</script>

<div class="kf">
	<header class="kf-kopf">
		<p>{kopf}</p>
		<h1>{titel}</h1>
		{#if unterzeile}<span>{unterzeile}</span>{/if}
	</header>
	{@render children()}
</div>

<style>
	.kf {
		min-height: 100vh;
		padding: 32px max(18px, calc((100vw - 1180px) / 2)) 56px;
		background: radial-gradient(circle at 50% -25%, #dededb, #c8c8c5 65%);
		color: #575756;
		font-family: 'DLRG Univers', Arial, sans-serif;
		font-size: 13px;
		line-height: 1.45;
	}
	/* Nicht darauf verlassen, dass eine globale CSS-Datei das setzt. */
	.kf,
	.kf :global(*) {
		box-sizing: border-box;
	}
	.kf-kopf {
		margin-bottom: 22px;
	}
	.kf-kopf p {
		margin: 0 0 7px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 1.7px;
		font-size: 10px;
		font-weight: 700;
	}
	.kf-kopf h1 {
		margin: 0;
		font-size: 32px;
		line-height: 1.1;
	}
	.kf-kopf span {
		display: block;
		margin-top: 8px;
		max-width: 640px;
		color: #6f6f6e;
	}

	/* ─── Bausteine für alle Kraftfahrer-Seiten ─── */
	.kf :global(.karte) {
		padding: 22px 24px;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
	}
	.kf :global(.karte + .karte),
	.kf :global(.stapel > * + *) {
		margin-top: 18px;
	}
	.kf :global(.karte > h2) {
		margin: 0 0 16px;
		padding-bottom: 12px;
		border-bottom: 3px solid #ffed00;
		font-size: 17px;
	}
	.kf :global(.karte > h2 small) {
		display: block;
		margin-top: 3px;
		color: #888;
		font-size: 11px;
		font-weight: 400;
	}
	.kf :global(.raster) {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 16px;
	}
	.kf :global(.ganz) {
		grid-column: 1 / -1;
	}
	.kf :global(label.feld),
	.kf :global(.feld) {
		display: block;
		font-size: 11px;
		font-weight: 700;
	}
	.kf :global(.feld input:not([type='checkbox'])),
	.kf :global(.feld select),
	.kf :global(.feld textarea) {
		display: block;
		width: 100%;
		min-height: 42px;
		margin-top: 6px;
		padding: 0 12px;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
		font: inherit;
		font-weight: 400;
		outline: none;
	}
	.kf :global(.feld textarea) {
		min-height: 80px;
		padding: 10px 12px;
		resize: vertical;
	}
	.kf :global(.feld input:focus),
	.kf :global(.feld select:focus),
	.kf :global(.feld textarea:focus) {
		border-color: #e30613;
		box-shadow: 0 0 0 3px #e3061314;
	}
	.kf :global(.feld [aria-invalid='true']) {
		border-color: #e30613;
		background: #fff6f6;
	}
	.kf :global(.feld em),
	.kf :global(em.fehlertext) {
		display: block;
		margin-top: 5px;
		color: #c8000d;
		font-size: 11px;
		font-weight: 400;
		font-style: normal;
	}
	.kf :global(.knopf) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 18px;
		border: 1px solid #c9c9c8;
		border-radius: 7px;
		background: #fff;
		color: #575756;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.kf :global(.knopf:hover:not(:disabled)) {
		border-color: #575756;
	}
	.kf :global(.knopf.rot) {
		border-color: #e30613;
		background: #e30613;
		color: #fff;
	}
	.kf :global(.knopf.rot:hover:not(:disabled)) {
		background: #c9000d;
	}
	.kf :global(.knopf.gelb) {
		border-color: #ffed00;
		background: #ffed00;
	}
	.kf :global(.knopf.leise) {
		border-color: transparent;
		background: transparent;
		color: #e30613;
	}
	.kf :global(.knopf:disabled) {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.kf :global(.knopf:focus-visible),
	.kf :global(.feld input:focus-visible) {
		outline: 2px solid #575756;
		outline-offset: 2px;
	}
	.kf :global(.hinweis) {
		margin: 0 0 18px;
		padding: 13px 16px;
		border-left: 4px solid #575756;
		border-radius: 8px;
		background: #fff;
	}
	.kf :global(.hinweis.gut) {
		border-color: #16855b;
		background: #e8f6f0;
		color: #125f42;
	}
	.kf :global(.hinweis.schlecht) {
		border-color: #e30613;
		background: #ffe9ea;
		color: #a3000a;
	}
	.kf :global(.hinweis.warten) {
		border-color: #ffed00;
		background: #fffbd6;
		color: #5f5500;
	}
	.kf :global(.hinweis strong) {
		display: block;
	}
	.kf :global(.leer) {
		margin: 0;
		padding: 18px;
		color: #999;
		text-align: center;
	}

	@media (max-width: 700px) {
		.kf {
			padding: 20px 12px 40px;
		}
		.kf-kopf h1 {
			font-size: 25px;
		}
		.kf :global(.karte) {
			padding: 18px 16px;
		}
		.kf :global(.raster) {
			grid-template-columns: 1fr;
		}
	}
</style>
