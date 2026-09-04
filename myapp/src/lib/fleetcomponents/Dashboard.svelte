<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import mqtt from 'mqtt';
	import type { MqttClient } from 'mqtt';
	import VehicleMap from './VehicleMap.svelte';
	import HomeDashboard from './HomeDashboard.svelte';
	import FleetManagement from './FleetManager.svelte';
	import UserManagement from './UserManagemant.svelte';
	import AppIcon from './AppIcon.svelte';
	import { parsePosition, distanceMeters, calculatedSpeed } from '$lib/fleet/position';
	import {
		loadVehicleData,
		saveVehicleData,
		loadRouteHistory,
		saveRouteHistory,
		pruneRoute,
	} from '$lib/fleet/fleetStorage';
	import type {
		AppConfig,
		AppView,
		ConnectionLogEntry,
		ConnectionStatus,
		RoutePoint,
		Vehicle,
		VehicleChanges,
		VehicleMapHandle,
	} from '$lib/fleet/types';
	let {
		config,
		initialVehicles,
	}: { config: AppConfig; initialVehicles: Vehicle[] } = $props();
	let vehicles = $state<Vehicle[]>(untrack(() => initialVehicles.map((v) => ({ ...v }))));
	let selectedId = $state(untrack(() => initialVehicles[0]?.id ?? ''));
	let connection = $state<ConnectionStatus>('connecting'),
		connectionText = $state('MQTT verbindet …'),
		mapComponent = $state<VehicleMapHandle>(),
		client: MqttClient | undefined,
		lastUpdate = $state('Noch keine Live-Position'),
		lastConnection = $state('Noch keine Verbindung'),
		connectionLog = $state<ConnectionLogEntry[]>([]),
		gpsHistory = $state<RoutePoint[]>([]),
		routePoints = $state<RoutePoint[]>([]),
		showRoute = $state(false),
		view = $state<AppView>('home'),
		showLogoutConfirm = $state(false),
		mapSheetOpen = $state(false);
	function select(id: string): void {
		selectedId = id;
		mapComponent?.focus(id);
	}
	function openMap(id: string = selectedId, route = false): void {
		selectedId = id;
		showRoute = route;
		view = 'map';
		setTimeout(() => mapComponent?.focus(id), 0);
	}
	function openFleet(id: string = selectedId): void {
		selectedId = id;
		view = 'fleet';
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
	function apply(payload: string): void {
		const p = parsePosition(payload);
		if (!p) {
			connection = 'error';
			connectionText = 'Datenformat ungültig';
			return;
		}
		let parsedTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
		if (typeof p.timestamp === 'number' && p.timestamp < 1e12) parsedTime = p.timestamp * 1000;
		const point: RoutePoint = {
			lat: p.lat,
			lng: p.lng,
			time: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
		};
		gpsHistory = [...gpsHistory, point].slice(-5);
		routePoints = pruneRoute(routePoints);
		if (!routePoints.length || distanceMeters(routePoints.at(-1)!, point) >= 8) {
			routePoints = pruneRoute([...routePoints, point]);
			saveRouteHistory(routePoints);
		}
		const computed = calculatedSpeed(gpsHistory);
		const speed = computed === null ? 'Unplausibel' : `${(computed ?? 0).toFixed(1)} km/h`;
		const stamp = new Date(point.time).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		vehicles = vehicles.map((v, i) =>
			i
				? v
				: {
						...v,
						lat: p.lat,
						lng: p.lng,
						status: 'available',
						label: 'Live',
						address: `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
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
		let cancelled = false,
			fallbackTimer: ReturnType<typeof setTimeout> | undefined,
			endpointIndex = 0;
		const endpoints = [config.brokerUrl];
		if (location.protocol === 'http:' && !endpoints.includes('ws://broker.hivemq.com:8000/mqtt'))
			endpoints.push('ws://broker.hivemq.com:8000/mqtt');
		function start() {
			try {
				if (cancelled) return;
				const endpoint = endpoints[endpointIndex];
				connection = 'connecting';
				connectionText = endpointIndex ? 'MQTT nutzt Port 8000 …' : 'MQTT verbindet …';
				logConnection('connecting', `Verbindungsversuch über ${endpoint}`);
				const mqttClient = mqtt.connect(endpoint, {
					clientId: `dlrg_web_${Math.random().toString(16).slice(2, 10)}`,
					protocolVersion: 4,
					clean: true,
					reconnectPeriod: 3000,
					connectTimeout: 10000,
					keepalive: 30,
				});
				client = mqttClient;
				fallbackTimer = setTimeout(() => {
					if (!client?.connected && endpointIndex + 1 < endpoints.length) {
						client?.end(true);
						endpointIndex++;
						start();
					} else if (!client?.connected) {
						connection = 'error';
						connectionText = 'Broker nicht erreichbar';
					}
				}, 11000);
				mqttClient.on('connect', () => {
					clearTimeout(fallbackTimer);
					connection = 'online';
					connectionText = 'MQTT verbunden';
					lastConnection = new Date().toLocaleString('de-DE', {
						day: '2-digit',
						month: '2-digit',
						hour: '2-digit',
						minute: '2-digit',
						second: '2-digit',
					});
					logConnection('online', 'Verbindung zum MQTT-Broker hergestellt');
					mqttClient.subscribe(config.topic, { qos: 0 }, (error) => {
						if (error) {
							connection = 'error';
							connectionText = 'Topic-Abo fehlgeschlagen';
							logConnection('error', 'Topic konnte nicht abonniert werden');
						} else logConnection('online', `Topic ${config.topic} abonniert`);
					});
				});
				mqttClient.on('message', (topic, payload) => {
					if (topic === config.topic) apply(payload.toString());
				});
				mqttClient.on('reconnect', () => {
					connection = 'connecting';
					connectionText = 'MQTT verbindet erneut …';
					logConnection('connecting', 'Automatischer Wiederverbindungsversuch');
				});
				mqttClient.on('offline', () => {
					connection = 'error';
					connectionText = 'MQTT offline';
					logConnection('error', 'Verbindung zum Broker verloren');
				});
				mqttClient.on('error', (error) => {
					connection = 'error';
					connectionText = error?.message?.includes('connack')
						? 'Broker lehnt Verbindung ab'
						: 'MQTT-Verbindung gestört';
					logConnection('error', error?.message || 'Unbekannter MQTT-Fehler');
				});
			} catch (error) {
				connection = 'error';
				connectionText = 'MQTT konnte nicht geladen werden';
				logConnection('error', 'MQTT-Modul konnte nicht gestartet werden');
				console.error('MQTT-Start fehlgeschlagen:', error);
			}
		}
		start();
		return () => {
			cancelled = true;
			clearTimeout(fallbackTimer);
			client?.end(true);
		};
	});
</script>

<main class="app" class:home-view={view !== 'map'}>
	<header>
		<div class="header-inner">
			<div class="brand">
				<img src={`${import.meta.env.BASE_URL}friedrichshafen.svg`} alt="DLRG Friedrichshafen" /><span
					><strong>Fahrzeugortung</strong><small>Interne Einsatzübersicht</small></span
				><i class="brand-divider"></i><img
					class="fleetmap-header"
					src={`${import.meta.env.BASE_URL}dlrg-fn-fleetmap.png`}
					alt="Fleetmap"
				/>
			</div>
			<nav>
				<button class:active={view === 'home'} onclick={() => (view = 'home')}>Dashboard</button><button
					class:active={view === 'fleet'}
					onclick={() => (view = 'fleet')}>Fahrzeuge</button
				><button class:active={view === 'map'} onclick={() => (view = 'map')}>Karte</button><button
					class:active={view === 'users'}
					onclick={() => (view = 'users')}>Benutzer</button
				>
			</nav>
			<div class="right">
				<button class="user" onclick={() => (showLogoutConfirm = true)}
					><b>AD</b><span><strong>Administrator</strong><small>Abmelden</small></span><i>↪</i></button
				>
			</div>
		</div>
	</header>
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
								<i>▰</i><span><strong>{vehicle.name}</strong><small>{vehicle.callSign}</small></span><em
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
					<span>● Verfügbar</span><span>● Im Einsatz</span><span>● Offline</span>
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
		<button class:active={view === 'home'} onclick={() => (view = 'home')}
			><AppIcon name="home" size={20} /><span>Dashboard</span></button
		><button class:active={view === 'fleet'} onclick={() => (view = 'fleet')}
			><AppIcon name="vehicle" size={20} /><span>Fahrzeuge</span></button
		><button class:active={view === 'map'} onclick={() => (view = 'map')}
			><AppIcon name="map" size={20} /><span>Karte</span></button
		><button class:active={view === 'users'} onclick={() => (view = 'users')}
			><AppIcon name="crew" size={20} /><span>Benutzer</span></button
		><button onclick={() => (showLogoutConfirm = true)}
			><AppIcon name="logout" size={20} /><span>Abmelden</span></button
		>
	</nav>
	{#if showLogoutConfirm}
		<div
			class="logout-backdrop"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget) showLogoutConfirm = false;
			}}
		>
		</div>
	{/if}
</main>

<style>
	.app {
		height: 100vh;
		overflow: hidden;
		background: #f3f5f6;
		display: grid;
		grid-template-rows: 72px 112px minmax(0, 1fr);
		color: #575756;
	}
	header {
		background: #e30613;
		border-bottom: 5px solid #ffed00;
		color: #fff;
		padding: 0 38px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.brand,
	.right,
	.user {
		display: flex;
		align-items: center;
	}
	.brand {
		gap: 13px;
	}
	.brand img {
		width: 94px;
	}
	.brand span,
	.user span {
		display: flex;
		flex-direction: column;
	}
	.brand small,
	.user small {
		color: #ffffffb5;
		font-size: 10px;
		margin-top: 3px;
	}
	.right {
		gap: 28px;
	}
	.user strong {
		font-size: 11px;
	}
	.user {
		gap: 9px;
		border: 0;
		border-left: 1px solid #ffffff42;
		background: none;
		color: #fff;
		padding-left: 24px;
		text-align: left;
	}
	.user > b {
		display: grid;
		place-items: center;
		width: 35px;
		height: 35px;
		border-radius: 50%;
		background: #ffed00;
		color: #79100f;
		font-size: 10px;
	}
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
	.row strong,
	.row small,
	.meta span,
	.meta b {
		display: block;
	}
	.row strong {
		font-size: 13px;
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
	@media (max-width: 850px) {
		.app,
		.app.home-view {
			height: 100dvh;
			min-height: 0;
			grid-template-rows: 60px minmax(0, 1fr) 68px !important;
		}
		.app > header {
			height: 60px;
			padding: 0 14px;
		}
		.app .header-inner {
			display: flex;
			justify-content: center;
		}
		.app .header-inner > nav,
		.app .header-inner .right,
		.brand span,
		.brand-divider,
		.fleetmap-header {
			display: none !important;
		}
		.app .header-inner .brand > img:first-child {
			width: 82px;
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
	@media (max-width: 850px) {
		.mobile-nav {
			grid-template-columns: repeat(5, 1fr) !important;
		}
		.mobile-nav button {
			min-width: 0;
			padding: 0 2px;
		}
	}
</style>
