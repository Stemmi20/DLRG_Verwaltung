<script lang="ts">
	import { untrack } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import { distanceMeters } from '$lib/fleet/position';
	import type {
		LoadoutItem,
		LoadoutState,
		RoutePoint,
		ServiceStatus,
		Vehicle,
		VehicleChanges,
	} from '$lib/fleet/types';
	let {
		vehicles,
		selectedId,
		routePoints = [],
		onsave,
		onopenmap,
		onshowroute,
	}: {
		vehicles: Vehicle[];
		selectedId: string;
		routePoints?: RoutePoint[];
		onsave: (changes: VehicleChanges) => void;
		onopenmap: (id: string) => void;
		onshowroute: (id: string) => void;
	} = $props();
	let currentId = $state(untrack(() => selectedId || vehicles[0]?.id || ''));
	let draft = $state<VehicleChanges>({
		id: '',
		name: '',
		callSign: '',
		serviceStatus: 'available',
		loadout: [],
		standardCrew: [],
		maintenance: {
			tuvDue: '',
			uvvDue: '',
			lastService: '',
			nextService: '',
			serviceMileage: '',
			notes: '',
		},
		appointments: [],
	});
	let newLoadout = $state('');
	let crewName = $state('');
	let crewRole = $state('');
	let loadoutQuantity = $state(1);
	let loadoutCategory = $state('Allgemein');
	let loadoutState = $state<LoadoutState>('present');
	let loadoutExpiry = $state('');
	let loadoutSearch = $state('');
	let original = $state('');
	let appointmentType = $state('');
	let appointmentDate = $state('');
	let appointmentNote = $state('');
	let saved = $state(false);
	const statusOptions: { value: ServiceStatus; label: string }[] = [
		{ value: 'available', label: 'Verfügbar' },
		{ value: 'mission', label: 'Im Einsatz' },
		{ value: 'out-of-service', label: 'Außer Dienst' },
		{ value: 'workshop', label: 'Werkstatt' },
		{ value: 'no-gps', label: 'Kein GPS-Signal' },
	];
	function statusLabel(value: ServiceStatus): string {
		return statusOptions.find((option) => option.value === value)?.label ?? 'Verfügbar';
	}
	function dueState(date: string): 'none' | 'overdue' | 'soon' | 'ok' {
		if (!date) return 'none';
		const target = new Date(`${date}T23:59:59`).getTime(),
			days = Math.ceil((target - Date.now()) / 86400000);
		return days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok';
	}
	function dueText(date: string): string {
		if (!date) return 'Kein Termin';
		const state = dueState(date);
		if (state === 'overdue') return `Überfällig · ${new Date(date).toLocaleDateString('de-DE')}`;
		if (state === 'soon') return `Bald fällig · ${new Date(date).toLocaleDateString('de-DE')}`;
		return new Date(date).toLocaleDateString('de-DE');
	}
	const vehicle = $derived(vehicles.find((item) => item.id === currentId) ?? vehicles[0]);
	const routeDistance = $derived(
		routePoints
			.slice(1)
			.reduce((sum, point, index) => sum + distanceMeters(routePoints[index], point), 0),
	);
	const routeStart = $derived(
		routePoints[0]?.time ? new Date(routePoints[0].time).toLocaleString('de-DE') : 'Keine Daten',
	);
	const routeEnd = $derived(
		routePoints.at(-1)?.time
			? new Date(routePoints.at(-1)!.time).toLocaleString('de-DE')
			: 'Keine Daten',
	);
	const filteredLoadout = $derived(
		(draft?.loadout ?? []).filter((item) =>
			`${item.name} ${item.category} ${item.state}`
				.toLowerCase()
				.includes(loadoutSearch.toLowerCase()),
		),
	);
	const dirty = $derived(draft ? JSON.stringify(draft) !== original : false);

	function edit(item: Vehicle): void {
		currentId = item.id;
		draft = {
			id: item.id,
			name: item.name,
			callSign: item.callSign,
			serviceStatus: item.serviceStatus ?? 'available',
			loadout: ((item.loadout ?? []) as Array<LoadoutItem | string>).map((entry) =>
				typeof entry === 'string'
					? { name: entry, quantity: 1, category: 'Allgemein', state: 'present' as const, expiry: '' }
					: { ...entry },
			),
			standardCrew: (item.standardCrew ?? []).map((person) => ({ ...person })),
			maintenance: { ...item.maintenance },
			appointments: (item.appointments ?? []).map((entry) => ({ ...entry })),
		};
		original = JSON.stringify(draft);
		saved = false;
	}
	$effect(() => {
		if (vehicle && (!draft || draft.id !== vehicle.id)) edit(vehicle);
	});
	function addLoadout(): void {
		if (!draft) return;
		const value = newLoadout.trim();
		if (!value) return;
		draft.loadout = [
			...draft.loadout,
			{
				name: value,
				quantity: Math.max(1, Number(loadoutQuantity) || 1),
				category: loadoutCategory,
				state: loadoutState,
				expiry: loadoutExpiry,
			},
		];
		newLoadout = '';
		loadoutQuantity = 1;
		loadoutExpiry = '';
	}
	function addCrew(): void {
		if (!draft) return;
		const name = crewName.trim(),
			role = crewRole.trim();
		if (!name) return;
		draft.standardCrew = [...draft.standardCrew, { name, role }];
		crewName = '';
		crewRole = '';
	}
	function addAppointment(): void {
		if (!draft) return;
		const type = appointmentType.trim();
		if (!type || !appointmentDate) return;
		draft.appointments = [
			...draft.appointments,
			{
				id: crypto.randomUUID?.() ?? `${Date.now()}`,
				type,
				date: appointmentDate,
				note: appointmentNote.trim(),
			},
		];
		appointmentType = '';
		appointmentDate = '';
		appointmentNote = '';
	}
	function save(): void {
		if (!draft) return;
		onsave(draft);
		original = JSON.stringify(draft);
		saved = true;
		setTimeout(() => (saved = false), 1800);
	}
</script>

<section class="management">
	<header class="page-head">
		<div>
			<p>Flottenverwaltung</p>
			<h1>Fahrzeuge verwalten</h1>
			<span>Stammdaten, Beladung, Besatzung und GPS-Verlauf an einem Ort.</span>
		</div>
	</header>
	<div class="layout">
		<aside class="vehicle-picker">
			<div class="panel-title">
				<small>Fahrzeugliste</small><strong>{vehicles.length} Fahrzeuge</strong>
			</div>
			{#each vehicles as item}<button class:active={item.id === currentId} onclick={() => edit(item)}
					><i><AppIcon name="vehicle" size={19} /></i><span
						><strong>{item.name}</strong><small>{item.callSign}</small></span
					><em class={item.serviceStatus}>{statusLabel(item.serviceStatus)}</em></button
				>{/each}
		</aside>
		{#if draft}
			<div class="editor">
				<section class="card identity">
					<div class="card-head">
						<i><AppIcon name="vehicle" /></i>
						<div>
							<small>Stammdaten</small>
							<h2>Fahrzeugbezeichnung</h2>
						</div>
					</div>
					<div class="fields">
						<label
							>Name<input bind:value={draft.name} placeholder="z. B. Gerätewagen Wasserrettung" /></label
						><label
							>Rufkennung / Kennung<input
								bind:value={draft.callSign}
								placeholder="z. B. Pelikan 1/59"
							/></label
						><label
							>Betriebsstatus<select bind:value={draft.serviceStatus}
								>{#each statusOptions as option}<option value={option.value}>{option.label}</option
									>{/each}</select
							></label
						>
					</div>
				</section>
				<section class="card loadout-card">
					<div class="card-head">
						<i><AppIcon name="list" /></i>
						<div>
							<small>Ausrüstung</small>
							<h2>Beladung</h2>
						</div>
						<b>{draft.loadout.length} Positionen</b>
					</div>
					<div class="loadout-form">
						<input class="loadout-name" bind:value={newLoadout} placeholder="Gegenstand" /><input
							type="number"
							min="1"
							bind:value={loadoutQuantity}
							aria-label="Anzahl"
						/><select bind:value={loadoutCategory} aria-label="Kategorie"
							><option>Allgemein</option><option>Wasserrettung</option><option>Medizin</option><option
								>Technik</option
							><option>Funk</option><option>Persönliche Schutzausrüstung</option></select
						><select bind:value={loadoutState} aria-label="Zustand"
							><option value="present">Vorhanden</option><option value="missing">Fehlt</option><option
								value="defective">Defekt</option
							><option value="inspection">In Prüfung</option></select
						><input type="date" bind:value={loadoutExpiry} aria-label="Ablaufdatum" /><button
							onclick={addLoadout}>+ Hinzufügen</button
						>
					</div>
					<div class="loadout-search">
						<input bind:value={loadoutSearch} placeholder="Beladung durchsuchen …" />
					</div>
					<div class="item-list detailed">
						{#if !filteredLoadout.length}<p>
								{draft.loadout.length ? 'Keine passenden Einträge.' : 'Noch keine Beladung hinterlegt.'}
							</p>{/if}{#each filteredLoadout as item}<div>
								<span
									><strong>{item.quantity}× {item.name}</strong><small
										>{item.category}{item.expiry
											? ` · Ablauf ${new Date(item.expiry).toLocaleDateString('de-DE')}`
											: ''}</small
									></span
								><em class={item.state}
									>{item.state === 'present'
										? 'Vorhanden'
										: item.state === 'missing'
											? 'Fehlt'
											: item.state === 'defective'
												? 'Defekt'
												: 'In Prüfung'}</em
								><button
									aria-label={`${item.name} entfernen`}
									onclick={() => (draft.loadout = draft.loadout.filter((entry) => entry !== item))}>×</button
								>
							</div>{/each}
					</div>
				</section>
				<section class="card">
					<div class="card-head">
						<i><AppIcon name="crew" /></i>
						<div>
							<small>Personal</small>
							<h2>Standardbesatzung</h2>
						</div>
						<b>{draft.standardCrew.length} Personen</b>
					</div>
					<div class="add-row crew">
						<input bind:value={crewName} placeholder="Name" /><input
							bind:value={crewRole}
							onkeydown={(e) => e.key === 'Enter' && addCrew()}
							placeholder="Funktion / Rolle"
						/><button onclick={addCrew}>+ Hinzufügen</button>
					</div>
					<div class="item-list">
						{#if !draft.standardCrew.length}<p>
								Noch keine Standardbesatzung definiert.
							</p>{/if}{#each draft.standardCrew as person, index}<div>
								<span
									><strong>{person.name}</strong><small>{person.role || 'Keine Rolle angegeben'}</small
									></span
								><button
									aria-label={`${person.name} entfernen`}
									onclick={() => (draft.standardCrew = draft.standardCrew.filter((_, i) => i !== index))}
									>×</button
								>
							</div>{/each}
					</div>
				</section>
				<section class="card maintenance-card">
					<div class="card-head">
						<i><AppIcon name="calendar" /></i>
						<div>
							<small>Fahrzeugpflege</small>
							<h2>Wartung & Prüftermine</h2>
						</div>
					</div>
					<div class="maintenance-grid">
						<label
							>TÜV fällig<input type="date" bind:value={draft.maintenance.tuvDue} /><span
								class={dueState(draft.maintenance.tuvDue)}>{dueText(draft.maintenance.tuvDue)}</span
							></label
						><label
							>UVV-Prüfung fällig<input type="date" bind:value={draft.maintenance.uvvDue} /><span
								class={dueState(draft.maintenance.uvvDue)}>{dueText(draft.maintenance.uvvDue)}</span
							></label
						><label>Letzter Service<input type="date" bind:value={draft.maintenance.lastService} /></label
						><label
							>Nächster Service<input type="date" bind:value={draft.maintenance.nextService} /><span
								class={dueState(draft.maintenance.nextService)}
								>{dueText(draft.maintenance.nextService)}</span
							></label
						><label
							>Kilometerstand beim Service<input
								type="number"
								min="0"
								bind:value={draft.maintenance.serviceMileage}
								placeholder="z. B. 42500"
							/></label
						><label class="notes"
							>Service-Notizen<textarea
								bind:value={draft.maintenance.notes}
								placeholder="Durchgeführte Arbeiten, Werkstatt, Besonderheiten …"
							></textarea></label
						>
					</div>
					<div class="appointment-head">
						<div><small>Weitere Termine</small><strong>Eigene Prüfungen und Erinnerungen</strong></div>
						<b>{draft.appointments.length}</b>
					</div>
					<div class="appointment-form">
						<input bind:value={appointmentType} placeholder="z. B. Funkprüfung" /><input
							type="date"
							bind:value={appointmentDate}
						/><input bind:value={appointmentNote} placeholder="Notiz (optional)" /><button
							onclick={addAppointment}>+ Termin</button
						>
					</div>
					<div class="appointment-list">
						{#if !draft.appointments.length}<p>
								Noch keine weiteren Termine eingetragen.
							</p>{/if}{#each [...draft.appointments].sort( (a, b) => a.date.localeCompare(b.date), ) as appointment}<article
							>
								<i class={dueState(appointment.date)}><AppIcon name="calendar" size={17} /></i><span
									><strong>{appointment.type}</strong><small>{appointment.note || 'Keine Notiz'}</small
									></span
								><em class={dueState(appointment.date)}>{dueText(appointment.date)}</em><button
									aria-label={`${appointment.type} entfernen`}
									onclick={() =>
										(draft.appointments = draft.appointments.filter((item) => item.id !== appointment.id))}
									>×</button
								>
							</article>{/each}
					</div>
				</section>
				<section class="card route-card">
					<div class="card-head">
						<i><AppIcon name="route" /></i>
						<div>
							<small>GPS-Historie</small>
							<h2>Standorte der letzten 24 Stunden</h2>
						</div>
					</div>
					<div class="route-stats">
						<div><small>GPS-Punkte</small><strong>{routePoints.length}</strong></div>
						<div><small>Strecke</small><strong>{(routeDistance / 1000).toFixed(2)} km</strong></div>
						<div><small>Erster Punkt</small><strong>{routeStart}</strong></div>
						<div><small>Letzter Punkt</small><strong>{routeEnd}</strong></div>
					</div>
					<div class="route-actions">
						<button disabled={!Number.isFinite(vehicle?.lat)} onclick={() => onopenmap(currentId)}
							><AppIcon name="location" size={18} /> Aktuellen Standort öffnen</button
						><button
							class="primary"
							disabled={routePoints.length < 2}
							onclick={() => onshowroute(currentId)}
							><AppIcon name="route" size={18} /> 24h-Route auf Karte</button
						>
					</div>
					<p class="hint">
						Die Historie wird auf diesem Gerät beim Empfang von GPS-Meldungen gespeichert und automatisch
						nach 24 Stunden entfernt.
					</p>
				</section>
				<div class="savebar">
					<span class:visible={saved || dirty}
						>{saved ? '✓ Änderungen gespeichert' : dirty ? '● Ungespeicherte Änderungen' : ''}</span
					><button disabled={!dirty} onclick={save}
						>{dirty ? 'Änderungen speichern' : 'Alles gespeichert'}</button
					>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
	.management {
		min-height: 0;
		overflow: auto;
		padding: 32px max(28px, calc((100vw - 1480px) / 2)) 48px;
		background: radial-gradient(circle at 50% -25%, #dededb, #c8c8c5 65%);
		color: #575756;
	}
	.page-head {
		margin-bottom: 25px;
	}
	.page-head p,
	.card-head small,
	.panel-title small {
		margin: 0 0 7px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 1.7px;
		font-size: 9px;
		font-weight: 700;
	}
	.page-head h1 {
		margin: 0;
		font-size: 35px;
	}
	.page-head span {
		display: block;
		margin-top: 8px;
		color: #747473;
		font-size: 12px;
	}
	.layout {
		display: grid;
		grid-template-columns: 310px minmax(0, 1fr);
		gap: 20px;
	}
	.vehicle-picker,
	.card {
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
		overflow: hidden;
	}
	.vehicle-picker {
		height: max-content;
	}
	.panel-title {
		padding: 21px;
		border-bottom: 4px solid #ffed00;
	}
	.panel-title strong {
		display: block;
	}
	.vehicle-picker > button {
		width: 100%;
		padding: 15px 17px;
		border: 0;
		border-bottom: 1px solid #e8e8e6;
		background: #fff;
		color: #575756;
		display: grid;
		grid-template-columns: 40px 1fr auto;
		gap: 11px;
		align-items: center;
		text-align: left;
	}
	.vehicle-picker > button.active {
		background: #f5f5f3;
		box-shadow: inset 4px 0 #e30613;
	}
	.vehicle-picker i,
	.card-head > i {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: #e30613;
		color: #ffed00;
	}
	.vehicle-picker span strong,
	.vehicle-picker span small {
		display: block;
	}
	.vehicle-picker span small {
		margin-top: 4px;
		color: #888;
		font-size: 9px;
	}
	.vehicle-picker em {
		padding: 5px 7px;
		border-radius: 12px;
		background: #eee;
		font-size: 8px;
		font-style: normal;
	}
	.vehicle-picker em.available {
		color: #16855b;
		background: #e8f6f0;
	}
	.vehicle-picker em.mission {
		color: #a75a00;
		background: #fff2df;
	}
	.vehicle-picker em.out-of-service,
	.vehicle-picker em.no-gps {
		color: #666;
		background: #eee;
	}
	.vehicle-picker em.workshop {
		color: #9a4c00;
		background: #ffe6cc;
	}
	.editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}
	.card {
		padding: 22px;
	}
	.identity,
	.loadout-card,
	.route-card,
	.savebar {
		grid-column: 1/-1;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 18px;
	}
	.card-head h2 {
		margin: 3px 0 0;
		font-size: 17px;
	}
	.card-head small {
		margin: 0;
		color: #888;
	}
	.card-head > b {
		margin-left: auto;
		color: #888;
		font-size: 10px;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 14px;
	}
	label {
		font-size: 10px;
		font-weight: 700;
	}
	input,
	select {
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
	input:focus,
	select:focus {
		border-color: #e30613;
		box-shadow: 0 0 0 3px #e3061312;
	}
	.add-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
	}
	.add-row.crew {
		grid-template-columns: 1fr 1fr auto;
	}
	.add-row input {
		margin: 0;
	}
	.add-row button,
	.savebar button,
	.route-actions button,
	.loadout-form button {
		border: 0;
		border-radius: 7px;
		background: #575756;
		color: #fff;
		padding: 0 15px;
		font-weight: 700;
		font-size: 10px;
	}
	.loadout-form {
		display: grid;
		grid-template-columns: minmax(170px, 1fr) 75px 160px 130px 145px auto;
		gap: 8px;
	}
	.loadout-form input,
	.loadout-form select {
		margin: 0;
	}
	.loadout-search {
		margin-top: 10px;
	}
	.loadout-search input {
		margin: 0;
	}
	.item-list {
		margin-top: 13px;
		border: 1px solid #e5e5e3;
		border-radius: 8px;
		overflow: hidden;
	}
	.item-list > p {
		margin: 0;
		padding: 20px;
		color: #999;
		text-align: center;
		font-size: 10px;
	}
	.item-list > div {
		min-height: 43px;
		padding: 9px 11px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid #ececea;
		font-size: 11px;
	}
	.item-list > div:last-child {
		border: 0;
	}
	.item-list small,
	.item-list strong {
		display: block;
	}
	.item-list small {
		margin-top: 3px;
		color: #888;
		font-size: 9px;
	}
	.item-list em {
		margin-left: auto;
		padding: 5px 8px;
		border-radius: 20px;
		background: #e8f6f0;
		color: #16855b;
		font-size: 8px;
		font-style: normal;
		font-weight: 700;
	}
	.item-list em.missing,
	.item-list em.defective {
		background: #ffe4e6;
		color: #be0712;
	}
	.item-list em.inspection {
		background: #fff3d1;
		color: #956b00;
	}
	.item-list button {
		border: 0;
		background: none;
		color: #e30613;
		font-size: 18px;
	}
	.route-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		border: 1px solid #dededc;
		border-radius: 8px;
		overflow: hidden;
		background: #dededc;
	}
	.route-stats > div {
		padding: 14px;
		background: #f8f8f7;
	}
	.route-stats small,
	.route-stats strong {
		display: block;
	}
	.route-stats small {
		color: #888;
		text-transform: uppercase;
		font-size: 8px;
	}
	.route-stats strong {
		margin-top: 7px;
		font-size: 11px;
	}
	.route-actions {
		display: flex;
		gap: 9px;
		margin-top: 14px;
	}
	.route-actions button {
		height: 43px;
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fff;
		color: #575756;
		border: 1px solid #cacac7;
	}
	.route-actions button.primary {
		background: #e30613;
		border-color: #e30613;
		color: #fff;
	}
	.route-actions button:disabled,
	.savebar button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.hint {
		margin: 13px 0 0;
		color: #888;
		font-size: 9px;
	}
	.savebar {
		position: sticky;
		bottom: 0;
		padding: 13px 15px;
		border-radius: 10px;
		background: #575756;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 18px;
		box-shadow: 0 8px 25px #0003;
	}
	.savebar span {
		color: #fff;
		font-size: 10px;
		opacity: 0;
	}
	.savebar span.visible {
		opacity: 1;
	}
	.savebar button {
		height: 42px;
		background: #ffed00;
		color: #575756;
	}
	.savebar button:hover:not(:disabled) {
		background: #fff;
	}
	@media (max-width: 1100px) {
		.loadout-form {
			grid-template-columns: 1fr 80px 1fr;
		}
		.loadout-form button {
			height: 42px;
		}
	}
	@media (max-width: 950px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.vehicle-picker {
			display: flex;
			overflow: auto;
		}
		.panel-title {
			min-width: 150px;
		}
		.vehicle-picker > button {
			min-width: 230px;
		}
		.editor {
			grid-template-columns: 1fr;
		}
		.identity,
		.loadout-card,
		.route-card,
		.savebar {
			grid-column: auto;
		}
		.fields {
			grid-template-columns: 1fr 1fr;
		}
		.route-stats {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 600px) {
		.management {
			padding: 18px 12px 26px;
		}
		.page-head {
			margin-bottom: 17px;
		}
		.page-head span {
			line-height: 1.45;
		}
		.vehicle-picker {
			margin: 0 -12px;
			border-radius: 0;
		}
		.panel-title {
			display: none;
		}
		.vehicle-picker > button {
			min-width: 220px;
		}
		.card {
			padding: 17px;
			border-radius: 10px;
		}
		.fields,
		.add-row.crew,
		.loadout-form {
			grid-template-columns: 1fr;
		}
		.add-row button,
		.loadout-form button {
			height: 43px;
		}
		.route-actions {
			flex-direction: column;
		}
		.route-stats {
			grid-template-columns: 1fr 1fr;
		}
		.page-head h1 {
			font-size: 27px;
		}
		.savebar {
			bottom: 4px;
			justify-content: space-between;
		}
		.savebar span {
			font-size: 9px;
		}
		.savebar button {
			padding: 0 12px;
		}
	}
	.maintenance-card {
		grid-column: 1/-1;
	}
	.maintenance-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 15px;
	}
	.maintenance-grid label > span {
		display: block;
		margin-top: 6px;
		color: #888;
		font-size: 8px;
		font-weight: 400;
	}
	.maintenance-grid label > span.soon {
		color: #9a6b00;
		font-weight: 700;
	}
	.maintenance-grid label > span.overdue {
		color: #e30613;
		font-weight: 700;
	}
	.maintenance-grid label.notes {
		grid-column: 1/-1;
	}
	.maintenance-grid textarea {
		width: 100%;
		min-height: 82px;
		margin-top: 7px;
		padding: 11px 12px;
		resize: vertical;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
		font: inherit;
		font-size: 11px;
		outline: none;
	}
	.maintenance-grid textarea:focus {
		border-color: #e30613;
		box-shadow: 0 0 0 3px #e3061312;
	}
	.appointment-head {
		margin-top: 22px;
		padding-top: 19px;
		border-top: 1px solid #e5e5e3;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.appointment-head small,
	.appointment-head strong {
		display: block;
	}
	.appointment-head small {
		color: #888;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-size: 8px;
	}
	.appointment-head strong {
		margin-top: 4px;
		font-size: 12px;
	}
	.appointment-head > b {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #ffed00;
		font-size: 10px;
	}
	.appointment-form {
		display: grid;
		grid-template-columns: 1fr 160px 1.3fr auto;
		gap: 8px;
		margin-top: 12px;
	}
	.appointment-form input {
		margin: 0;
	}
	.appointment-form button {
		border: 0;
		border-radius: 7px;
		background: #575756;
		color: #fff;
		padding: 0 15px;
		font-size: 10px;
		font-weight: 700;
	}
	.appointment-list {
		margin-top: 12px;
		border: 1px solid #e5e5e3;
		border-radius: 8px;
		overflow: hidden;
	}
	.appointment-list > p {
		margin: 0;
		padding: 20px;
		color: #999;
		text-align: center;
		font-size: 10px;
	}
	.appointment-list article {
		min-height: 58px;
		padding: 10px 12px;
		border-bottom: 1px solid #ececea;
		display: grid;
		grid-template-columns: 36px 1fr auto 28px;
		gap: 10px;
		align-items: center;
	}
	.appointment-list article:last-child {
		border: 0;
	}
	.appointment-list article > i {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 7px;
		background: #e8f6f0;
		color: #16855b;
	}
	.appointment-list article > i.soon {
		background: #fff3d1;
		color: #956b00;
	}
	.appointment-list article > i.overdue {
		background: #ffe4e6;
		color: #e30613;
	}
	.appointment-list strong,
	.appointment-list small {
		display: block;
	}
	.appointment-list strong {
		font-size: 11px;
	}
	.appointment-list small {
		margin-top: 3px;
		color: #888;
		font-size: 9px;
	}
	.appointment-list em {
		padding: 5px 8px;
		border-radius: 20px;
		background: #e8f6f0;
		color: #16855b;
		font-size: 8px;
		font-style: normal;
		font-weight: 700;
	}
	.appointment-list em.soon {
		background: #fff3d1;
		color: #956b00;
	}
	.appointment-list em.overdue {
		background: #ffe4e6;
		color: #e30613;
	}
	.appointment-list article > button {
		border: 0;
		background: none;
		color: #e30613;
		font-size: 18px;
	}
	@media (max-width: 950px) {
		.maintenance-card {
			grid-column: auto;
		}
		.maintenance-grid {
			grid-template-columns: 1fr 1fr;
		}
		.appointment-form {
			grid-template-columns: 1fr 1fr;
		}
		.appointment-form button {
			height: 42px;
		}
	}
	@media (max-width: 600px) {
		.maintenance-grid,
		.appointment-form {
			grid-template-columns: 1fr;
		}
		.maintenance-grid label.notes {
			grid-column: auto;
		}
		.appointment-list article {
			grid-template-columns: 36px 1fr 28px;
		}
		.appointment-list em {
			grid-column: 2;
		}
		.appointment-form button {
			height: 43px;
		}
	}
</style>
