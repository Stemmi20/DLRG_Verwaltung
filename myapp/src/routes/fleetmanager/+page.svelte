<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import VehicleMap from '$lib/fleetcomponents/VehicleMap.svelte';
	import HomeDashboard from '$lib/fleetcomponents/HomeDashboard.svelte';
	import FleetManagement from '$lib/fleetcomponents/FleetManager.svelte';
	import UserManagement from '$lib/fleetcomponents/UserManagemant.svelte';
	import AppIcon from '$lib/fleetcomponents/AppIcon.svelte';
	import { distanceMeters, calculatedSpeed } from '$lib/fleet/position';
	import type { Fahrzeug, TrackerEvent } from '$lib/types/tracker';
	import { appConfig, defaultVehicles } from '$lib/fleet/defaults';
	import {
		loadVehicleData,
		saveVehicleData,
		loadRouteHistory,
		saveRouteHistory,
		pruneRoute,
	} from '$lib/fleet/fleetStorage';
	import type {
		AppView,
		ConnectionLogEntry,
		ConnectionStatus,
		RoutePoint,
		Vehicle,
		VehicleChanges,
		VehicleMapHandle,
	} from '$lib/fleet/types';

	// Konfiguration und Fahrzeuge kommen aus $lib/fleet/defaults – die Seite
	// braucht keine Props mehr und lässt sich direkt aufrufen.
	const config = appConfig;

	let vehicles = $state<Vehicle[]>(defaultVehicles.map((v) => ({ ...v })));
	let selectedId = $state(defaultVehicles[0]?.id ?? '');
	/**
	 * Aus tracker/<id>/position wird die ID gelesen: der Server liefert alle
	 * Tracker, dieses Board zeigt nur seinen eigenen.
	 */
	const trackerId = config.topic.split('/')[1] ?? '';

	let connection = $state<ConnectionStatus>('connecting'),
		connectionText = $state('Verbindet …'),
		mapComponent = $state<VehicleMapHandle>(),
		lastUpdate = $state('Noch keine Live-Position'),
		lastConnection = $state('Noch keine Verbindung'),
		connectionLog = $state<ConnectionLogEntry[]>([]),
		gpsHistory = $state<RoutePoint[]>([]),
		routePoints = $state<RoutePoint[]>([]),
		showRoute = $state(false),
		mapSheetOpen = $state(false);

	/*
	 * Die Ansicht steht in der URL. Dadurch kann die Navbar im Layout sie
	 * setzen, ohne dass beide Komponenten eine eigene Kopie führen.
	 */
	const view = $derived(($page.url.searchParams.get('view') as AppView) ?? 'home');

	function zeige(ansicht: AppView): Promise<void> {
		return goto(`/fleetmanager?view=${ansicht}`, { noScroll: true, keepFocus: true });
	}

	function select(id: string): void {
		selectedId = id;
		mapComponent?.focus(id);
	}
	async function openMap(id: string = selectedId, route = false): Promise<void> {
		selectedId = id;
		showRoute = route;
		await zeige('map');
		setTimeout(() => mapComponent?.focus(id), 0);
	}
	async function openFleet(id: string = selectedId): Promise<void> {
		selectedId = id;
		await zeige('fleet');
	}
	function saveVehicle(changes: VehicleChanges): void {
		vehicles = vehicles.map((vehicle) =>
			vehicle.id === changes.id ? { ...vehicle, ...changes } : vehicle,
		);
		saveVehicleData(vehicles);
	}
	function logConnection(type: ConnectionStatus, message: string): void {
		connectionLog = [
			{
				type,
				message,
				time: new Date().toLocaleString('de-DE', {
					day: '2-digit',
					month: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				}),
			},
			...connectionLog,
		].slice(0, 30);
	}
	function apply(f: Fahrzeug): void {
		if (trackerId && trackerId !== '+' && f.id !== trackerId) return;

		// spur[0] ist die neueste Position, siehe $lib/types/tracker.
		const aktuell = f.spur[0];
		if (!aktuell) return;

		const parsedTime = Date.parse(aktuell.am);
		const point: RoutePoint = {
			lat: aktuell.lat,
			lng: aktuell.lng,
			time: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
		};
		gpsHistory = [...gpsHistory, point].slice(-5);
		routePoints = pruneRoute(routePoints);
		if (!routePoints.length || distanceMeters(routePoints.at(-1)!, point) >= 8) {
			routePoints = pruneRoute([...routePoints, point]);
			saveRouteHistory(routePoints);
		}
		// Liefert der Tracker eine Geschwindigkeit, hat sie Vorrang vor der
		// aus den letzten Punkten gerechneten.
		const computed = aktuell.speed ?? calculatedSpeed(gpsHistory);
		const speed = computed === null ? 'Unplausibel' : `${computed.toFixed(1)} km/h`;
		const stamp = new Date(point.time).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		// Die Live-Position landet auf dem ersten Fahrzeug der Liste.
		vehicles = vehicles.map((v, i) =>
			i
				? v
				: {
						...v,
						// Fehlt der Name in einer Meldung, bleibt der bisherige stehen.
						name: f.name || v.name,
						lat: aktuell.lat,
						lng: aktuell.lng,
						status: 'available',
						label: 'Live',
						address: `${aktuell.lat.toFixed(6)}, ${aktuell.lng.toFixed(6)}`,
						updated: stamp,
						speed,
					},
		);
		lastUpdate = stamp;
	}
	onMount(() => {
		const stored = loadVehicleData();
		vehicles = vehicles.map((vehicle) => ({
			...vehicle,
			...(stored[vehicle.id] ?? {}),
			loadout: stored[vehicle.id]?.loadout ?? vehicle.loadout ?? [],
			standardCrew: stored[vehicle.id]?.standardCrew ?? vehicle.standardCrew ?? [],
		}));
		routePoints = loadRouteHistory();
		/*
		 * Die Positionen kommen über Server-Sent Events von /api/tracker/stream.
		 * Der Server hält die MQTT-Verbindung samt Zugangsdaten – im Browser
		 * liegt damit kein Brokerzugang mehr.
		 */
		connection = 'connecting';
		connectionText = 'Verbindet …';
		logConnection('connecting', 'Verbindungsversuch über /api/tracker/stream');

		const es = new EventSource('/api/tracker/stream');

		es.onopen = () => {
			connection = 'online';
			connectionText = 'Live-Daten verbunden';
			lastConnection = new Date().toLocaleString('de-DE', {
				day: '2-digit',
				month: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			});
			logConnection('online', 'Verbindung zum Server hergestellt');
		};

		es.onmessage = (ereignis) => {
			let daten: TrackerEvent;
			try {
				daten = JSON.parse(ereignis.data) as TrackerEvent;
			} catch {
				logConnection('error', 'Nachricht vom Server unlesbar');
				return;
			}
			// 'ping' hält nur die Verbindung offen und wird übergangen.
			if (daten.art === 'init') for (const f of daten.fahrzeuge) apply(f);
			else if (daten.art === 'position') apply(daten.fahrzeug);
		};

		es.onerror = () => {
			/*
			 * EventSource verbindet von allein neu – der Server schickt dafür
			 * ein retry. Nur ein endgültig geschlossener Stream ist ein Fehler.
			 */
			if (es.readyState === EventSource.CLOSED) {
				connection = 'error';
				connectionText = 'Verbindung zum Server verloren';
				logConnection('error', 'Stream geschlossen');
			} else {
				connection = 'connecting';
				connectionText = 'Verbindet erneut …';
				logConnection('connecting', 'Automatischer Wiederverbindungsversuch');
			}
		};

		return () => es.close();
	});
</script>

<main class="app" class:home-view={view !== 'map'}>
	{#if view === 'home'}
		<HomeDashboard
			{vehicles}
			{connection}
			{connectionText}
			{lastConnection}
			{connectionLog}
			{lastUpdate}
			routeCount={Math.max(0, routePoints.length - 1)}
			onopenmap={(id) => openMap(id)}
			onshowroute={(id) => openMap(id, true)}
			onmanage={openFleet}
		/>
	{:else if view === 'fleet'}
		<FleetManagement
			{vehicles}
			{selectedId}
			{routePoints}
			onsave={saveVehicle}
			onopenmap={(id) => openMap(id)}
			onshowroute={(id) => openMap(id, true)}
		/>
	{:else if view === 'users'}
		<UserManagement {vehicles} />
	{:else}
		<section class="toolbar">
			<div>
				<p>Einsatzübersicht</p>
				<h1>Fahrzeugstandorte</h1>
				<small>● Live-Daten · Letzte Position: {lastUpdate}</small>
			</div>
			<div class="actions"><button onclick={() => mapComponent?.fit()}>⊙ Alle Fahrzeuge</button></div>
		</section>
		<section class="dashboard">
			<aside class:sheet-open={mapSheetOpen}>
				<button
					class="sheet-handle"
					aria-label="Fahrzeugliste öffnen"
					onclick={() => (mapSheetOpen = !mapSheetOpen)}
					><i></i><span>Fahrzeuge · {vehicles.length}</span><b>{mapSheetOpen ? '⌄' : '⌃'}</b></button
				>
				<div class="aside-head">
					<span><strong>Fahrzeugübersicht</strong><small>{vehicles.length} Einheiten</small></span><b
						>≡</b
					>
				</div>
				<div class="list">
					{#each vehicles as vehicle}<button
							class:active={vehicle.id === selectedId}
							onclick={() => {
								select(vehicle.id);
								mapSheetOpen = false;
							}}
							><div class="row">
								<i>▰</i><span>
								<!-- <strong>{vehicle.name}</strong> -->
								<small>{vehicle.callSign}</small></span><em
									class={vehicle.status}>{vehicle.label}</em
								>
							</div>
							<div class="meta">
								<span>Position<b>{vehicle.address}</b></span><span
									>Standort aktualisiert<b>{vehicle.updated}</b></span
								><span>Geschwindigkeit<b>{vehicle.speed}</b></span><span
									>GPS<b>{vehicle.status === 'offline' ? 'Kein Signal' : 'Sehr gut'}</b></span
								>
							</div></button
						>{/each}
				</div>
				<div class="route-control">
					<button onclick={() => (showRoute = !showRoute)} disabled={routePoints.length < 2}
						>{showRoute
							? 'Route ausblenden'
							: routePoints.length < 2
								? 'Route ab erster Bewegung'
								: 'Route anzeigen'} <span>↗</span></button
					><small>{Math.max(0, routePoints.length - 1)} Bewegungsabschnitte erfasst</small>
				</div>
				<div class="legend">
					<span>● Einsatzbereit auf der Wache</span><span>● Im Einsatz</span><span>● Offline</span>
				</div>
			</aside>
			<div class="map-shell">
				<VehicleMap
					bind:this={mapComponent}
					{vehicles}
					{selectedId}
					onselect={select}
					center={config.mapCenter}
					zoom={config.mapZoom}
					{routePoints}
					{showRoute}
				/>
				<div class="map-label"><small>OpenStreetMap</small><strong>Friedrichshafen</strong></div>
				<div class="mobile-map-actions">
					<button onclick={() => mapComponent?.locate()}>◎<span>Mein Standort</span></button><button
						onclick={() => mapComponent?.fit()}>⊙<span>Alle</span></button
					><button
						class:active={showRoute}
						disabled={routePoints.length < 2}
						onclick={() => (showRoute = !showRoute)}>⌁<span>Route</span></button
					>
				</div>
			</div>
		</section>
	{/if}
	<nav class="mobile-nav" aria-label="Hauptnavigation">
		<button class:active={view === 'home'} onclick={() => zeige('home')}
			><AppIcon name="home" size={20} /><span>Dashboard</span></button
		><button class:active={view === 'fleet'} onclick={() => zeige('fleet')}
			><AppIcon name="vehicle" size={20} /><span>Fahrzeuge</span></button
		><button class:active={view === 'map'} onclick={() => zeige('map')}
			><AppIcon name="map" size={20} /><span>Karte</span></button
		><button class:active={view === 'users'} onclick={() => zeige('users')}
			><AppIcon name="crew" size={20} /><span>Benutzer</span></button
		>
	</nav>
</main>

<style>
	/* ─── Grundgerüst ───────────────────────────────────────────────── */
	.app {
		height: calc(100vh - var(--navbar-hoehe));
		overflow: hidden;
		background: #f3f5f6;
		display: grid;
		/* Toolbar · Inhalt – die Kopfzeile stellt jetzt die Navbar im Layout */
		grid-template-rows: 112px minmax(0, 1fr);
		color: #575756;
	}
	/* Dashboard, Fahrzeuge und Benutzer haben keine Toolbar – ohne diese
	   Regel bleibt deren 112px hoher Streifen als weiße Fläche stehen. */
	.app.home-view {
		grid-template-rows: minmax(0, 1fr);
	}

	/* ─── Toolbar (nur Kartenansicht) ───────────────────────────────── */
	.toolbar {
		background: #fff;
		border-bottom: 1px solid #dededc;
		padding: 18px 38px;
		display: flex;
		justify-content: space-between;
		align-items: end;
	}
	.toolbar p {
		margin: 0 0 6px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-size: 10px;
		font-weight: bold;
	}
	.toolbar h1 {
		font-size: 29px;
		line-height: 1;
		margin: 0 0 9px;
	}
	.toolbar small {
		color: #575756;
	}
	.actions button {
		padding: 11px 15px;
		background: #fff;
		border: 1px solid #c9c9c8;
		border-radius: 5px;
		font-weight: bold;
	}

	/* ─── Kartenansicht ─────────────────────────────────────────────── */
	.dashboard {
		min-height: 0;
		margin: 18px 38px 24px;
		display: grid;
		grid-template-columns: 340px minmax(0, 1fr);
		background: #fff;
		border: 1px solid #dededc;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 12px 38px #57575617;
	}
	.dashboard > aside {
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid #dededc;
		background: #fff;
	}
	.aside-head {
		padding: 18px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 3px solid #ffed00;
	}
	.aside-head span {
		display: flex;
		flex-direction: column;
	}
	.aside-head small {
		color: #575756;
		margin-top: 3px;
	}
	.aside-head > b {
		padding: 7px 10px;
		background: #f1f3f4;
		border-radius: 4px;
	}
	.list {
		min-height: 0;
		overflow: auto;
	}
	.list > button {
		width: 100%;
		padding: 17px 18px;
		border: 0;
		border-bottom: 1px solid #dededc;
		border-left: 4px solid transparent;
		background: #fff;
		text-align: left;
	}
	.list > button:hover {
		background: #fafafa;
	}
	.list > button.active {
		border-left-color: #e30613;
		background: linear-gradient(90deg, #e3061317, #fff 72%);
	}
	.row {
		display: flex;
		align-items: start;
		gap: 11px;
	}
	.row > i {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 5px;
		background: #f0f2f3;
		color: #e30613;
		font-style: normal;
	}
	.active .row > i {
		background: #e30613;
		color: #ffed00;
	}
	.row > span {
		flex: 1;
	}
	.row small,
	.meta span,
	.meta b {
		display: block;
	}

	.row small {
		font-size: 10px;
		color: #575756;
		margin-top: 3px;
	}
	.row em {
		font-style: normal;
		font-size: 9px;
		font-weight: bold;
		padding: 5px 7px;
		border-radius: 18px;
	}
	.row em.available {
		color: #16855b;
		background: #e8f6f0;
	}
	.row em.mission {
		color: #b55f00;
		background: #fff2df;
	}
	.row em.offline {
		color: #667078;
		background: #edf0f2;
	}
	.meta {
		margin: 13px 0 0 49px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 9px;
		color: #575756;
		font-size: 9px;
	}
	.meta b {
		margin-top: 3px;
		color: #575756;
		font-weight: normal;
		overflow-wrap: anywhere;
	}

	/* Routenschalter unter der Fahrzeugliste. */
	.route-control {
		padding: 14px 16px;
		border-top: 1px solid #dededc;
		background: #fafafa;
	}
	.route-control button {
		width: 100%;
		height: 38px;
		padding: 0 11px;
		border: 1px solid #e30613;
		border-radius: 5px;
		background: #fff;
		color: #e30613;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 10px;
		font-weight: 700;
	}
	.route-control button:hover:not(:disabled) {
		background: #e30613;
		color: #fff;
	}
	.route-control button:disabled {
		border-color: #c9c9c8;
		color: #8b8b89;
		cursor: not-allowed;
	}
	.route-control small {
		display: block;
		margin-top: 7px;
		color: #575756;
		text-align: center;
		font-size: 8px;
	}

	.legend {
		padding: 13px;
		display: flex;
		justify-content: center;
		gap: 12px;
		font-size: 9px;
		color: #575756;
	}
	.map-shell {
		position: relative;
		min-width: 0;
	}
	.map-label {
		position: absolute;
		z-index: 500;
		top: 16px;
		left: 54px;
		background: #fffffff0;
		border-left: 4px solid #e30613;
		padding: 9px 13px;
		box-shadow: 0 3px 13px #5757561b;
	}
	.map-label small,
	.map-label strong {
		display: block;
	}
	.map-label small {
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #575756;
		font-size: 8px;
	}
	.map-label strong {
		font-size: 12px;
		margin-top: 2px;
	}

	.sheet-handle,
	.mobile-map-actions,
	.mobile-nav {
		display: none;
	}

	/* ─── Mittlere Breiten ──────────────────────────────────────────── */
	/* ─── Mobil ─────────────────────────────────────────────────────── */
	@media (max-width: 850px) {
		.app,
		.app.home-view {
			height: calc(100dvh - var(--navbar-hoehe));
			min-height: 0;
			/* Inhalt · untere Navigation */
			grid-template-rows: minmax(0, 1fr) 68px;
		}
		.toolbar {
			display: none;
		}
		.dashboard {
			position: relative;
			margin: 0;
			display: block;
			border: 0;
			border-radius: 0;
			box-shadow: none;
			overflow: hidden;
		}
		.map-shell {
			position: absolute;
			inset: 0;
		}
		.map-label {
			top: 14px;
			left: 14px;
		}
		.dashboard > aside {
			position: absolute;
			z-index: 750;
			left: 10px;
			right: 10px;
			bottom: 10px;
			height: min(64vh, 520px);
			border: 0;
			border-radius: 15px 15px 10px 10px;
			box-shadow: 0 12px 40px #0005;
			transform: translateY(calc(100% - 58px));
			transition: transform 0.25s ease;
			overflow: hidden;
		}
		.dashboard > aside.sheet-open {
			transform: translateY(0);
		}
		.sheet-handle {
			position: relative;
			height: 58px;
			flex: none;
			padding: 0 18px;
			border: 0;
			border-bottom: 1px solid #e5e5e3;
			background: #fff;
			color: #575756;
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.sheet-handle i {
			position: absolute;
			top: 7px;
			left: 50%;
			transform: translateX(-50%);
			width: 36px;
			height: 4px;
			border-radius: 5px;
			background: #c8c8c5;
		}
		.sheet-handle span {
			font-weight: 700;
		}
		.sheet-handle b {
			margin-left: auto;
			color: #e30613;
			font-size: 18px;
		}
		.aside-head {
			display: none;
		}
		.list {
			flex: 1;
		}
		.route-control {
			flex: none;
		}
		.legend {
			display: none;
		}
		.mobile-map-actions {
			position: absolute;
			z-index: 600;
			right: 12px;
			top: 14px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.mobile-map-actions button {
			width: 48px;
			min-height: 48px;
			padding: 6px 3px;
			border: 0;
			border-radius: 9px;
			background: #fff;
			color: #575756;
			box-shadow: 0 4px 15px #0003;
			font-size: 18px;
			font-weight: 700;
		}
		.mobile-map-actions span {
			display: block;
			margin-top: 2px;
			font-size: 7px;
		}
		.mobile-map-actions button.active {
			background: #e30613;
			color: #fff;
		}
		.mobile-map-actions button:disabled {
			opacity: 0.45;
		}
		.mobile-nav {
			z-index: 1000;
			padding: 5px 7px max(5px, env(safe-area-inset-bottom));
			border-top: 1px solid #d4d4d1;
			background: #fff;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			box-shadow: 0 -4px 18px #0002;
		}
		.mobile-nav button {
			min-width: 0;
			padding: 0 2px;
			border: 0;
			border-radius: 8px;
			background: transparent;
			color: #777;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			font-size: 8px;
		}
		.mobile-nav button.active {
			background: #e3061310;
			color: #e30613;
			font-weight: 700;
		}
	}
</style>