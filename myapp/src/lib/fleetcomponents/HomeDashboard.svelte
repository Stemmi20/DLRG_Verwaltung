<script lang="ts">
	import AppIcon from './AppIcon.svelte';
	import type { ConnectionLogEntry, ConnectionStatus, Vehicle } from '$lib/fleet/types';
	let {
		vehicles,
		connection,
		connectionText,
		lastConnection,
		connectionLog,
		lastUpdate,
		routeCount = 0,
		onopenmap,
		onshowroute,
		onmanage,
	}: {
		vehicles: Vehicle[];
		connection: ConnectionStatus;
		connectionText: string;
		lastConnection: string;
		connectionLog: ConnectionLogEntry[];
		lastUpdate: string;
		routeCount?: number;
		onopenmap: (id?: string) => void;
		onshowroute: (id: string) => void;
		onmanage: (id?: string) => void;
	} = $props();
	let selectedVehicle = $state<Vehicle | null>(null);
	let showConnectionLog = $state(false);
	const liveCount = $derived(vehicles.filter((vehicle) => vehicle.status === 'available').length);
	const missionCount = $derived(vehicles.filter((vehicle) => vehicle.status === 'mission').length);
	const offlineCount = $derived(vehicles.filter((vehicle) => vehicle.status === 'offline').length);
	const statusOptions = [
		{ value: 'available', label: 'Verfügbar' },
		{ value: 'mission', label: 'Im Einsatz' },
		{ value: 'out-of-service', label: 'Außer Dienst' },
		{ value: 'workshop', label: 'Werkstatt' },
		{ value: 'no-gps', label: 'Kein GPS-Signal' },
	];
	function statusLabel(value: string | undefined): string {
		return statusOptions.find((option) => option.value === value)?.label ?? 'Verfügbar';
	}
	function statusCount(value: string): number {
		return vehicles.filter((vehicle) => (vehicle.serviceStatus ?? 'available') === value).length;
	}
	function dayDistance(date: string): number {
		return Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
	}
	function dateLabel(date: string): string {
		return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
	}
	function openSelectedMap(): void {
		if (selectedVehicle) onopenmap(selectedVehicle.id);
	}
	function openSelectedRoute(): void {
		if (selectedVehicle) onshowroute(selectedVehicle.id);
	}
	const dashboardInfo = $derived.by(() => {
		const alerts = [],
			appointments = [];
		const maintenanceFields: Array<['tuvDue' | 'uvvDue' | 'nextService', string]> = [
			['tuvDue', 'TÜV'],
			['uvvDue', 'UVV-Prüfung'],
			['nextService', 'Nächster Service'],
		];
		for (const vehicle of vehicles) {
			if (['out-of-service', 'workshop', 'no-gps'].includes(vehicle.serviceStatus))
				alerts.push({
					vehicleId: vehicle.id,
					vehicle: vehicle.name,
					title: statusLabel(vehicle.serviceStatus),
					detail: 'Betriebsstatus prüfen',
					severity: vehicle.serviceStatus === 'out-of-service' ? 'critical' : 'warning',
				});
			for (const item of vehicle.loadout ?? []) {
				if (item.state === 'missing' || item.state === 'defective')
					alerts.push({
						vehicleId: vehicle.id,
						vehicle: vehicle.name,
						title: `${item.name}: ${item.state === 'missing' ? 'fehlt' : 'defekt'}`,
						detail: `Beladung · ${item.category ?? 'Allgemein'}`,
						severity: 'critical',
					});
				if (item.expiry && dayDistance(item.expiry) <= 30)
					alerts.push({
						vehicleId: vehicle.id,
						vehicle: vehicle.name,
						title: `${item.name}: Ablaufdatum`,
						detail:
							dayDistance(item.expiry) < 0
								? `Abgelaufen am ${dateLabel(item.expiry)}`
								: `Fällig am ${dateLabel(item.expiry)}`,
						severity: dayDistance(item.expiry) < 0 ? 'critical' : 'warning',
					});
			}
			for (const [field, title] of maintenanceFields) {
				const date = vehicle.maintenance?.[field];
				if (!date) continue;
				const days = dayDistance(date);
				appointments.push({ vehicleId: vehicle.id, vehicle: vehicle.name, title, date, days });
				if (days <= 30)
					alerts.push({
						vehicleId: vehicle.id,
						vehicle: vehicle.name,
						title,
						detail: days < 0 ? `Seit ${Math.abs(days)} Tagen überfällig` : `In ${days} Tagen fällig`,
						severity: days < 0 ? 'critical' : 'warning',
					});
			}
			for (const entry of vehicle.appointments ?? []) {
				if (!entry.date) continue;
				const days = dayDistance(entry.date);
				appointments.push({
					vehicleId: vehicle.id,
					vehicle: vehicle.name,
					title: entry.type,
					date: entry.date,
					days,
				});
				if (days <= 30)
					alerts.push({
						vehicleId: vehicle.id,
						vehicle: vehicle.name,
						title: entry.type,
						detail: days < 0 ? `Seit ${Math.abs(days)} Tagen überfällig` : `In ${days} Tagen fällig`,
						severity: days < 0 ? 'critical' : 'warning',
					});
			}
		}
		return {
			alerts: alerts.slice(0, 8),
			appointments: appointments
				.filter((item) => item.days >= 0)
				.sort((a, b) => a.date.localeCompare(b.date))
				.slice(0, 6),
		};
	});
</script>

<section class="home">
	<div class="welcome">
		<div>
			<p>Fleetmap Dashboard</p>
			<h1>Guten Tag, Administrator.</h1>
			<span>Hier findest du den aktuellen Überblick über Fahrzeuge und Standortmeldungen.</span>
		</div>
	</div>

	<div class="quick-grid">
		<button class="quick-card map-card" onclick={() => onopenmap()}>
			<div class="card-icon"><AppIcon name="map" /></div>
			<span
				><small>Live-Ansicht</small><strong>Zur Kartenansicht</strong><em
					>Fahrzeuge und aufgezeichnete Routen auf OpenStreetMap öffnen.</em
				></span
			><b>→</b>
		</button>
		<article class="quick-card status-card">
			<div class="card-icon"><AppIcon name="status" /></div>
			<span
				><small>Fahrzeugstatus</small><strong>{liveCount} von {vehicles.length} online</strong><em
					>Letzte Positionsmeldung: {lastUpdate}</em
				></span
			>
			<div class="status-bars">
				<i class="live" style={`--value:${vehicles.length ? (liveCount / vehicles.length) * 100 : 0}%`}
				></i>
			</div>
		</article>
		<button class="quick-card overview-card" onclick={() => onmanage(vehicles[0]?.id)}>
			<div class="card-icon"><AppIcon name="vehicle" /></div>
			<span
				><small>Flotte</small><strong>Fahrzeugübersicht</strong><em
					>Details, GPS-Status und letzte Aktualisierung ansehen.</em
				></span
			><b>→</b>
		</button>
		<button class="quick-card mqtt-card" onclick={() => (showConnectionLog = true)}>
			<div class="card-icon"><AppIcon name="status" /></div>
			<span
				><small>MQTT-Verbindung</small><strong>{connectionText}</strong><em
					>Letzte Verbindung:<br />{lastConnection}</em
				></span
			><b>→</b>
		</button>
	</div>

	<div class="content-grid">
		<section class="fleet-panel">
			<header>
				<div>
					<small>Aktueller Stand</small>
					<h2>Fahrzeuge</h2>
				</div>
				<button onclick={() => onopenmap()}>Alle auf Karte <span>→</span></button>
			</header>
			<div class="fleet-list">
				{#each vehicles as vehicle}
					<button onclick={() => onmanage(vehicle.id)}>
						<i class="vehicle-symbol"><AppIcon name="vehicle" size={19} /></i>
						<span class="vehicle-title"
							><strong>{vehicle.name}</strong><small>{vehicle.callSign}</small></span
						>
						<span class="vehicle-update"
							><small>Letzte Aktualisierung</small><strong>{vehicle.updated}</strong></span
						>
						<em class={vehicle.serviceStatus ?? 'available'}>{statusLabel(vehicle.serviceStatus)}</em><b
							>›</b
						>
					</button>
				{/each}
			</div>
		</section>

		<aside class="summary-panel">
			<small>Flottenstatus</small>
			<h2>Übersicht</h2>
			{#each statusOptions as option}<div class="summary-row">
					<i class={option.value}></i><span>{option.label}</span><strong
						>{statusCount(option.value)}</strong
					>
				</div>{/each}
			<div class="summary-total"><span>Fahrzeuge gesamt</span><strong>{vehicles.length}</strong></div>
		</aside>
	</div>

	<div class="insight-grid">
		<section class="insight-panel alert-panel">
			<header>
				<div>
					<small>Aufmerksamkeit erforderlich</small>
					<h2>Handlungsbedarf</h2>
				</div>
				<b class:has-alerts={dashboardInfo.alerts.length}>{dashboardInfo.alerts.length}</b>
			</header>
			<div class="insight-list">
				{#if dashboardInfo.alerts.length === 0}<div class="empty">
						<i>✓</i><span
							><strong>Alles im grünen Bereich</strong><small
								>Aktuell liegen keine fälligen Warnungen vor.</small
							></span
						>
					</div>{/if}
				{#each dashboardInfo.alerts as alert}<button onclick={() => onmanage(alert.vehicleId)}
						><i class={alert.severity}>!</i><span
							><strong>{alert.title}</strong><small>{alert.vehicle} · {alert.detail}</small></span
						><b>›</b></button
					>{/each}
			</div>
		</section>
		<section class="insight-panel appointment-panel">
			<header>
				<div>
					<small>Wartungskalender</small>
					<h2>Nächste Termine</h2>
				</div>
				<i><AppIcon name="calendar" size={21} /></i>
			</header>
			<div class="insight-list">
				{#if dashboardInfo.appointments.length === 0}<div class="empty">
						<i>–</i><span
							><strong>Keine Termine geplant</strong><small
								>Termine lassen sich in der Fahrzeugverwaltung hinterlegen.</small
							></span
						>
					</div>{/if}
				{#each dashboardInfo.appointments as appointment}<button
						onclick={() => onmanage(appointment.vehicleId)}
						><time
							><strong
								>{new Date(`${appointment.date}T12:00:00`).toLocaleDateString('de-DE', {
									day: '2-digit',
								})}</strong
							><small
								>{new Date(`${appointment.date}T12:00:00`).toLocaleDateString('de-DE', {
									month: 'short',
								})}</small
							></time
						><span
							><strong>{appointment.title}</strong><small
								>{appointment.vehicle} · {appointment.days === 0
									? 'Heute'
									: `in ${appointment.days} Tagen`}</small
							></span
						><b>›</b></button
					>{/each}
			</div>
		</section>
	</div>

	{#if selectedVehicle}
		<div
			class="modal-backdrop"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget) selectedVehicle = null;
			}}
		>
			<div
				class="vehicle-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="vehicle-dialog-title"
			>
				<header>
					<div class="modal-icon"><AppIcon name="vehicle" size={27} /></div>
					<div>
						<small>Fahrzeugdetails</small>
						<h2 id="vehicle-dialog-title">{selectedVehicle.name}</h2>
						<span>{selectedVehicle.callSign}</span>
					</div>
					<button aria-label="Fenster schließen" onclick={() => (selectedVehicle = null)}>×</button>
				</header>
				<div class="detail-status">
					<span class={selectedVehicle.serviceStatus ?? 'available'}></span>
					<div>
						<small>Betriebsstatus</small><strong>{statusLabel(selectedVehicle.serviceStatus)}</strong>
					</div>
				</div>
				<div class="detail-grid">
					<div><small>Letzte Position</small><strong>{selectedVehicle.address}</strong></div>
					<div><small>Aktualisiert</small><strong>{selectedVehicle.updated}</strong></div>
					<div><small>Geschwindigkeit</small><strong>{selectedVehicle.speed}</strong></div>
					<div>
						<small>GPS-Signal</small><strong
							>{selectedVehicle.status === 'offline' ? 'Kein Signal' : 'Sehr gut'}</strong
						>
					</div>
				</div>
				<div class="modal-actions">
					<button
						class="primary"
						disabled={!Number.isFinite(selectedVehicle.lat)}
						onclick={openSelectedMap}
						><AppIcon name="location" size={18} /><span>Standort auf Karte</span></button
					><button disabled={routeCount < 1} onclick={openSelectedRoute}
						><AppIcon name="route" size={18} /><span>Letzte Route anzeigen</span><small
							>{routeCount} Abschnitte</small
						></button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if showConnectionLog}
		<div
			class="modal-backdrop"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget) showConnectionLog = false;
			}}
		>
			<div
				class="vehicle-modal log-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="connection-log-title"
			>
				<header>
					<div class="modal-icon"><AppIcon name="status" size={27} /></div>
					<div>
						<small>Systemdiagnose</small>
						<h2 id="connection-log-title">MQTT-Verbindungslog</h2>
						<span>{connectionText}</span>
					</div>
					<button aria-label="Fenster schließen" onclick={() => (showConnectionLog = false)}>×</button>
				</header>
				<div class="log-summary">
					<span class={connection}></span>
					<div>
						<small>Aktueller Status</small><strong>{connectionText}</strong><em
							>Letzte Verbindung: {lastConnection}</em
						>
					</div>
				</div>
				<div class="log-list">
					{#if connectionLog.length === 0}<p>Noch keine Verbindungsereignisse vorhanden.</p>{/if}
					{#each connectionLog as entry}<article>
							<i class={entry.type}></i><time>{entry.time}</time><span>{entry.message}</span>
						</article>{/each}
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.home {
		min-height: 0;
		overflow: auto;
		padding: 32px 38px 40px;
		background: #f4f4f3;
	}
	.welcome {
		display: flex;
		align-items: end;
		justify-content: space-between;
		margin-bottom: 27px;
	}
	.welcome p {
		margin: 0 0 8px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-size: 10px;
		font-weight: 700;
	}
	.welcome h1 {
		margin: 0;
		color: #575756;
		font-size: 34px;
		letter-spacing: -1px;
	}
	.welcome > div > span {
		display: block;
		margin-top: 9px;
		color: #777;
		font-size: 12px;
	}
	.quick-grid {
		display: grid;
		grid-template-columns: 1.25fr 1fr 1fr;
		gap: 16px;
	}
	.quick-card {
		min-height: 142px;
		padding: 22px;
		border: 1px solid #dededc;
		border-radius: 8px;
		background: #fff;
		display: flex;
		align-items: start;
		gap: 15px;
		text-align: left;
		color: #575756;
		box-shadow: 0 6px 20px #5757560b;
	}
	.quick-card:hover {
		border-color: #e30613;
		transform: translateY(-1px);
	}
	.map-card {
		background: #e30613;
		color: #fff;
		border-color: #e30613;
	}
	.card-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 7px;
		background: #f1f1ef;
		color: #e30613;
		font-size: 21px;
		font-style: normal;
	}
	.map-card .card-icon {
		background: #ffed00;
		color: #575756;
	}
	.quick-card > span {
		flex: 1;
	}
	.quick-card small,
	.quick-card strong,
	.quick-card em {
		display: block;
	}
	.quick-card small {
		text-transform: uppercase;
		letter-spacing: 1.2px;
		font-size: 8px;
		opacity: 0.72;
	}
	.quick-card strong {
		margin-top: 7px;
		font-size: 17px;
	}
	.quick-card em {
		margin-top: 10px;
		font-size: 10px;
		line-height: 1.45;
		font-style: normal;
		opacity: 0.75;
	}
	.quick-card > b {
		align-self: center;
		font-size: 20px;
	}
	.status-bars {
		align-self: end;
		width: 42px;
		height: 5px;
		background: #e5e5e3;
		border-radius: 8px;
		overflow: hidden;
	}
	.status-bars i {
		display: block;
		height: 100%;
		width: var(--value);
		background: #16855b;
	}
	.content-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 270px;
		gap: 16px;
		margin-top: 16px;
	}
	.fleet-panel,
	.summary-panel {
		border: 1px solid #dededc;
		border-radius: 8px;
		background: #fff;
		overflow: hidden;
	}
	.fleet-panel > header {
		padding: 18px 20px;
		border-bottom: 3px solid #ffed00;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.fleet-panel h2,
	.summary-panel h2 {
		margin: 4px 0 0;
		font-size: 18px;
	}
	.fleet-panel small,
	.summary-panel > small {
		color: #777;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.fleet-panel header button {
		border: 0;
		background: none;
		color: #e30613;
		font-size: 10px;
		font-weight: bold;
	}
	.fleet-list > button {
		width: 100%;
		padding: 16px 20px;
		border: 0;
		border-bottom: 1px solid #e7e7e5;
		background: #fff;
		display: grid;
		grid-template-columns: 38px minmax(140px, 1fr) minmax(140px, 0.8fr) auto 12px;
		gap: 13px;
		align-items: center;
		text-align: left;
		color: #575756;
	}
	.fleet-list > button:hover {
		background: #fafafa;
	}
	.vehicle-symbol {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 5px;
		background: #e30613;
		color: #ffed00;
		font-style: normal;
	}
	.vehicle-title strong,
	.vehicle-title small,
	.vehicle-update strong,
	.vehicle-update small {
		display: block;
	}
	.vehicle-title strong {
		font-size: 12px;
	}
	.vehicle-title small,
	.vehicle-update small {
		margin-top: 3px;
		color: #777;
		font-size: 9px;
	}
	.vehicle-update strong {
		margin-top: 3px;
		font-size: 10px;
		font-weight: 400;
	}
	.fleet-list em {
		padding: 5px 8px;
		border-radius: 20px;
		font-size: 8px;
		font-style: normal;
		font-weight: bold;
	}
	.fleet-list em.available {
		color: #16855b;
		background: #e8f6f0;
	}
	.fleet-list em.mission {
		color: #a75a00;
		background: #fff2df;
	}
	.fleet-list em.out-of-service,
	.fleet-list em.no-gps {
		color: #666;
		background: #eee;
	}
	.fleet-list em.workshop {
		color: #934800;
		background: #ffe4c7;
	}
	.summary-panel {
		padding: 20px;
	}
	.summary-row {
		display: grid;
		grid-template-columns: 9px 1fr auto;
		gap: 9px;
		align-items: center;
		padding: 11px 0;
		border-bottom: 1px solid #e7e7e5;
		font-size: 11px;
	}
	.summary-row i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #999;
	}
	.summary-row i.available {
		background: #16855b;
	}
	.summary-row i.mission {
		background: #e98212;
	}
	.summary-row i.workshop {
		background: #b55f00;
	}
	.summary-row i.out-of-service {
		background: #575756;
	}
	.summary-row i.no-gps {
		background: #e30613;
	}
	.summary-total {
		margin: 18px -20px -20px;
		padding: 17px 20px;
		background: #575756;
		color: #fff;
		display: flex;
		justify-content: space-between;
		font-size: 11px;
	}
	.summary-total strong {
		color: #ffed00;
		font-size: 18px;
	}
	@media (max-width: 1000px) {
		.quick-grid {
			grid-template-columns: 1fr;
		}
		.content-grid {
			grid-template-columns: 1fr;
		}
		.home {
			padding: 24px;
		}
		.welcome {
			align-items: start;
		}
	}
	@media (max-width: 650px) {
		.welcome h1 {
			font-size: 27px;
		}
		.fleet-list > button {
			grid-template-columns: 38px 1fr auto;
		}
		.vehicle-update {
			display: none;
		}
		.content-grid {
			grid-template-columns: 1fr;
		}
	}
	/* Zentrierte App-Übersicht für breite Bildschirme */
	.home {
		padding: 38px max(28px, calc((100vw - 1480px) / 2)) 48px;
		background: radial-gradient(circle at 50% -25%, #dededb 0, #d2d2cf 42%, #c8c8c5 100%);
	}
	.welcome,
	.quick-grid,
	.content-grid {
		width: 100%;
		max-width: 1480px;
		margin-left: auto;
		margin-right: auto;
	}
	.welcome {
		margin-bottom: 30px;
		padding: 0 4px;
	}
	.welcome h1 {
		font-size: 38px;
	}
	.welcome > div > span {
		font-size: 13px;
	}

	.quick-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
	}
	.quick-card {
		position: relative;
		min-height: 196px;
		padding: 27px 25px;
		border: 0;
		border-radius: 13px;
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		align-content: start;
		gap: 17px;
		background: #fff;
		color: #575756;
		box-shadow: 0 10px 32px rgba(87, 87, 86, 0.11);
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}
	.quick-card:before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 5px;
		background: #e30613;
	}
	.status-card:before {
		background: #ffed00;
	}
	.overview-card:before {
		background: #575756;
	}
	.quick-card:hover {
		border-color: transparent;
		transform: translateY(-4px);
		box-shadow: 0 18px 38px rgba(87, 87, 86, 0.17);
	}
	.map-card {
		background: #fff;
		color: #575756;
		border-color: transparent;
	}
	.card-icon,
	.map-card .card-icon {
		width: 54px;
		height: 54px;
		border-radius: 11px;
		background: #e30613;
		color: #ffed00;
		font-size: 24px;
		box-shadow: 0 7px 16px #e3061326;
	}
	.status-card .card-icon {
		background: #ffed00;
		color: #575756;
		box-shadow: 0 7px 16px #ffed0035;
	}
	.overview-card .card-icon {
		background: #575756;
		color: #fff;
		box-shadow: 0 7px 16px #57575630;
	}
	.quick-card small {
		font-size: 9px;
		opacity: 0.65;
	}
	.quick-card strong {
		margin-top: 9px;
		font-size: 20px;
		letter-spacing: -0.3px;
	}
	.quick-card em {
		margin-top: 12px;
		max-width: 310px;
		font-size: 11px;
		line-height: 1.55;
		opacity: 0.72;
	}
	.quick-card > b {
		position: absolute;
		right: 23px;
		bottom: 22px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: #f0f0ee;
		color: #e30613;
		font-size: 16px;
	}
	.status-bars {
		position: absolute;
		left: 96px;
		right: 25px;
		bottom: 27px;
		width: auto;
		height: 6px;
	}
	.content-grid {
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 20px;
		margin-top: 24px;
	}
	.fleet-panel,
	.summary-panel {
		border: 0;
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(87, 87, 86, 0.09);
	}
	.fleet-panel > header {
		padding: 21px 23px;
	}
	.fleet-list > button {
		padding: 18px 23px;
	}
	.summary-panel {
		padding: 23px;
	}
	.summary-total {
		margin: 20px -23px -23px;
		padding: 19px 23px;
	}
	@media (max-width: 1000px) {
		.home {
			padding: 26px 24px 40px;
		}
		.quick-grid {
			grid-template-columns: 1fr;
		}
		.quick-card {
			min-height: 165px;
		}
		.content-grid {
			grid-template-columns: 1fr;
		}
		.welcome h1 {
			font-size: 32px;
		}
	}
	.modal-backdrop {
		position: fixed;
		z-index: 2000;
		inset: 0;
		padding: 24px;
		background: rgba(45, 45, 44, 0.58);
		backdrop-filter: blur(5px);
		display: grid;
		place-items: center;
	}
	.vehicle-modal {
		width: min(540px, 100%);
		overflow: hidden;
		border-radius: 14px;
		background: #f5f5f3;
		box-shadow: 0 35px 90px rgba(0, 0, 0, 0.32);
	}
	.vehicle-modal > header {
		position: relative;
		padding: 25px;
		background: #e30613;
		color: #fff;
		display: flex;
		align-items: center;
		gap: 15px;
		border-bottom: 5px solid #ffed00;
	}
	.modal-icon {
		display: grid;
		place-items: center;
		width: 50px;
		height: 50px;
		border-radius: 9px;
		background: #ffed00;
		color: #575756;
	}
	.vehicle-modal header small,
	.vehicle-modal header span,
	.vehicle-modal header h2 {
		display: block;
	}
	.vehicle-modal header small {
		text-transform: uppercase;
		letter-spacing: 1.4px;
		font-size: 8px;
		opacity: 0.75;
	}
	.vehicle-modal header h2 {
		margin: 4px 0 3px;
		font-size: 22px;
	}
	.vehicle-modal header span {
		font-size: 10px;
		opacity: 0.8;
	}
	.vehicle-modal header > button {
		position: absolute;
		right: 17px;
		top: 16px;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 50%;
		background: #ffffff1f;
		color: #fff;
		font-size: 22px;
	}
	.detail-status {
		margin: 20px 22px 0;
		padding: 14px 16px;
		border-radius: 7px;
		background: #fff;
		display: flex;
		align-items: center;
		gap: 11px;
	}
	.detail-status > span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #999;
	}
	.detail-status > span.available {
		background: #16855b;
	}
	.detail-status > span.mission {
		background: #e98212;
	}
	.detail-status small,
	.detail-status strong {
		display: block;
	}
	.detail-status small,
	.detail-grid small {
		color: #777;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		font-size: 8px;
	}
	.detail-status strong {
		margin-top: 3px;
		font-size: 12px;
	}
	.detail-grid {
		margin: 12px 22px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: #dededc;
		border: 1px solid #dededc;
		border-radius: 7px;
		overflow: hidden;
	}
	.detail-grid > div {
		min-height: 75px;
		padding: 15px;
		background: #fff;
	}
	.detail-grid strong {
		display: block;
		margin-top: 7px;
		font-size: 11px;
		overflow-wrap: anywhere;
	}
	.modal-actions {
		padding: 10px 22px 22px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.modal-actions button {
		min-height: 57px;
		padding: 11px 13px;
		border: 1px solid #c7c7c4;
		border-radius: 7px;
		background: #fff;
		color: #575756;
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 7px;
		align-items: center;
		text-align: left;
		font-weight: 700;
	}
	.modal-actions button.primary {
		border-color: #e30613;
		background: #e30613;
		color: #fff;
	}
	.modal-actions button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.modal-actions button small {
		grid-column: 2;
		font-size: 8px;
		font-weight: 400;
		opacity: 0.7;
	}
	@media (max-width: 560px) {
		.detail-grid,
		.modal-actions {
			grid-template-columns: 1fr;
		}
		.vehicle-modal > header {
			padding: 20px;
		}
		.modal-backdrop {
			padding: 12px;
		}
	}
	.quick-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px;
	}
	.mqtt-card:before {
		background: #16855b;
	}
	.mqtt-card .card-icon {
		background: #16855b;
		color: #fff;
		box-shadow: 0 7px 16px #16855b30;
	}
	.log-modal {
		max-height: min(680px, 90vh);
		display: flex;
		flex-direction: column;
	}
	.log-summary {
		margin: 20px 22px 10px;
		padding: 15px;
		border-radius: 7px;
		background: #fff;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.log-summary > span {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: #e30613;
		box-shadow: 0 0 0 5px #e3061314;
	}
	.log-summary > span.online {
		background: #16855b;
		box-shadow: 0 0 0 5px #16855b14;
	}
	.log-summary > span.connecting {
		background: #ffed00;
	}
	.log-summary small,
	.log-summary strong,
	.log-summary em {
		display: block;
	}
	.log-summary small {
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: #777;
		font-size: 8px;
	}
	.log-summary strong {
		margin-top: 3px;
		font-size: 12px;
	}
	.log-summary em {
		margin-top: 4px;
		color: #777;
		font-size: 9px;
		font-style: normal;
	}
	.log-list {
		margin: 0 22px 22px;
		min-height: 120px;
		overflow: auto;
		border: 1px solid #dededc;
		border-radius: 7px;
		background: #fff;
	}
	.log-list > p {
		padding: 25px;
		color: #777;
		text-align: center;
		font-size: 10px;
	}
	.log-list article {
		display: grid;
		grid-template-columns: 8px 105px 1fr;
		gap: 10px;
		align-items: center;
		padding: 12px 14px;
		border-bottom: 1px solid #ececea;
	}
	.log-list article > i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #e30613;
	}
	.log-list article > i.online {
		background: #16855b;
	}
	.log-list article > i.connecting {
		background: #ffbf00;
	}
	.log-list time {
		color: #777;
		font-size: 9px;
	}
	.log-list article > span {
		font-size: 10px;
		overflow-wrap: anywhere;
	}
	@media (max-width: 1250px) {
		.quick-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		.quick-grid {
			grid-template-columns: 1fr;
		}
		.log-list article {
			grid-template-columns: 8px 1fr;
		}
		.log-list time {
			grid-column: 2;
		}
		.log-list article > span {
			grid-column: 2;
		}
	}
	.insight-grid {
		width: 100%;
		max-width: 1480px;
		margin: 24px auto 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.insight-panel {
		min-width: 0;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px rgba(87, 87, 86, 0.09);
		overflow: hidden;
	}
	.insight-panel > header {
		padding: 20px 22px;
		border-bottom: 3px solid #ffed00;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.alert-panel > header {
		border-bottom-color: #e30613;
	}
	.insight-panel header small {
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-size: 8px;
	}
	.insight-panel h2 {
		margin: 5px 0 0;
		font-size: 18px;
	}
	.alert-panel header > b {
		display: grid;
		place-items: center;
		min-width: 30px;
		height: 30px;
		padding: 0 8px;
		border-radius: 18px;
		background: #eee;
		color: #777;
		font-size: 11px;
	}
	.alert-panel header > b.has-alerts {
		background: #e30613;
		color: #fff;
	}
	.appointment-panel header > i {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: #ffed00;
		color: #575756;
	}
	.insight-list {
		max-height: 330px;
		overflow: auto;
	}
	.insight-list > button {
		width: 100%;
		min-height: 65px;
		padding: 11px 17px;
		border: 0;
		border-bottom: 1px solid #ececea;
		background: #fff;
		color: #575756;
		display: grid;
		grid-template-columns: 38px 1fr 12px;
		gap: 11px;
		align-items: center;
		text-align: left;
	}
	.insight-list > button:hover {
		background: #fafafa;
	}
	.insight-list > button > i {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 8px;
		background: #fff3d1;
		color: #956b00;
		font-style: normal;
		font-weight: 700;
	}
	.insight-list > button > i.critical {
		background: #ffe4e6;
		color: #e30613;
	}
	.insight-list span strong,
	.insight-list span small {
		display: block;
	}
	.insight-list span strong {
		font-size: 11px;
	}
	.insight-list span small {
		margin-top: 4px;
		color: #888;
		font-size: 9px;
	}
	.insight-list > button > b {
		color: #e30613;
	}
	.insight-list time {
		width: 38px;
		height: 42px;
		border-radius: 7px;
		background: #575756;
		color: #fff;
		display: grid;
		place-items: center;
		align-content: center;
		text-align: center;
	}
	.insight-list time strong,
	.insight-list time small {
		display: block;
	}
	.insight-list time strong {
		font-size: 13px;
	}
	.insight-list time small {
		text-transform: uppercase;
		font-size: 7px;
	}
	.empty {
		min-height: 112px;
		padding: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: #777;
	}
	.empty > i {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #e8f6f0;
		color: #16855b;
		font-style: normal;
		font-weight: 700;
	}
	.empty strong,
	.empty small {
		display: block;
	}
	.empty strong {
		font-size: 11px;
	}
	.empty small {
		margin-top: 4px;
		font-size: 9px;
	}
	@media (max-width: 900px) {
		.insight-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 700px) {
		.insight-grid {
			margin-top: 18px;
			gap: 14px;
		}
		.insight-panel {
			border-radius: 10px;
		}
		.insight-list {
			max-height: none;
		}
	}
</style>
