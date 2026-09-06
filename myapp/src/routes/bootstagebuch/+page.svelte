<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		<p>DLRG Friedrichshafen</p>
		<h1>Bootstagebuch</h1>
		<span>{data.boote.length} Boote</span>
	</header>

	{#if data.boote.length === 0}
		<p class="leer">
			Noch kein Boot angelegt. Die vier Boote kommen über <code>prisma/seed.ts</code> in die
			Datenbank.
		</p>
	{:else}
		<div class="raster">
			{#each data.boote as boot (boot.id)}
				<a class="karte" href="/bootstagebuch/{boot.id}">
					<strong>{boot.funkname}</strong>
					{#if boot.liegeort}<small>{boot.liegeort}</small>{/if}
					<dl>
						<div>
							<dt>Blätter</dt>
							<dd>{boot.blaetter}</dd>
						</div>
						<div>
							<dt>Letzter Dienst</dt>
							<dd>{boot.letzterDienst ? datumText(boot.letzterDienst) : '—'}</dd>
						</div>
						{#each boot.maschinen as m (m.id)}
							<div>
								<dt>{m.bezeichnung}</dt>
								<dd>{m.betriebsstunden !== null ? `${m.betriebsstunden} Std.` : '—'}</dd>
							</div>
						{/each}
					</dl>
				</a>
			{/each}
		</div>
	{/if}
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
	.raster {
		margin-top: 20px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}
	.karte {
		padding: 22px;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
		color: inherit;
		text-decoration: none;
		display: block;
		transition: 0.15s;
	}
	.karte:hover {
		box-shadow: 0 14px 34px #5757571f;
		transform: translateY(-2px);
	}
	.karte strong {
		display: block;
		padding-bottom: 12px;
		border-bottom: 3px solid #ffed00;
		font-size: 16px;
	}
	.karte small {
		display: block;
		margin-top: 10px;
		color: #888;
		font-size: 11px;
	}
	dl {
		margin: 14px 0 0;
		display: grid;
		gap: 8px;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	dt {
		color: #888;
		font-size: 10px;
	}
	dd {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
	}
	.leer {
		margin-top: 24px;
		padding: 40px 22px;
		border-radius: 12px;
		background: #fff;
		color: #999;
		text-align: center;
		font-size: 12px;
	}
	code {
		padding: 2px 5px;
		border-radius: 4px;
		background: #f1f1ef;
		font-size: 11px;
	}
	@media (max-width: 600px) {
		.seite {
			padding: 20px 14px 32px;
		}
		header h1 {
			font-size: 25px;
		}
	}
</style>