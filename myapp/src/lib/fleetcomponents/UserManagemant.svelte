<script lang="ts">
	import { onMount } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import {
		areas,
		roleDefaults,
		roleLabels,
		listUsers,
		saveUsers,
		createUser,
	} from '$lib/fleet/userRepository';
	import type { FleetUser, UserRole, Vehicle } from '$lib/fleet/types';
	let { vehicles = [] }: { vehicles?: Vehicle[] } = $props();
	let users = $state<FleetUser[]>([]),
		selectedId = $state(''),
		draft = $state<FleetUser>(createUser()),
		original = $state(''),
		saved = $state(false),
		showNew = $state(false);
	const dirty = $derived(draft ? JSON.stringify(draft) !== original : false);
	onMount(async () => {
		users = await listUsers();
		edit(users[0]);
	});
	function edit(user: FleetUser | undefined): void {
		if (!user) return;
		selectedId = user.id;
		draft = {
			...user,
			permissions: [...(user.permissions ?? [])],
			vehicleIds: [...(user.vehicleIds ?? [])],
		};
		original = JSON.stringify(draft);
		showNew = false;
	}
	function newUser(): void {
		const user = createUser();
		selectedId = user.id;
		draft = user;
		original = '';
		showNew = true;
	}
	function setRole(role: UserRole): void {
		if (!draft) return;
		draft.role = role;
		draft.permissions = [...roleDefaults[role]];
	}
	function toggle(list: string[], key: string): string[] {
		return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
	}
	async function save(): Promise<void> {
		if (!draft) return;
		const next = showNew
			? [...users, draft]
			: users.map((user) => (user.id === draft!.id ? draft! : user));
		users = await saveUsers(next);
		showNew = false;
		original = JSON.stringify(draft);
		saved = true;
		setTimeout(() => (saved = false), 1800);
	}
</script>

<section class="users-page">
	<header class="page-head">
		<div>
			<p>Administration</p>
			<h1>Benutzer & Zugriffsrechte</h1>
			<span>Lege fest, welche Bereiche und Fahrzeuge ein Benutzer später sehen darf.</span>
		</div>
		<button onclick={newUser}>+ Benutzer anlegen</button>
	</header>
	<div class="users-layout">
		<aside class="user-list">
			<div class="list-head">
				<small>Benutzerkonten</small><strong>{users.length} Benutzer</strong>
			</div>
			{#each users as user}<button class:active={user.id === selectedId} onclick={() => edit(user)}
					><i>{(user.displayName || user.username || '?').slice(0, 2).toUpperCase()}</i><span
						><strong>{user.displayName || 'Unbenannter Benutzer'}</strong><small
							>@{user.username || 'ohne-benutzername'}</small
						></span
					><em class:inactive={!user.active}>{user.active ? 'Aktiv' : 'Gesperrt'}</em></button
				>{/each}
		</aside>
		{#if draft}<div class="user-editor">
				<section class="editor-card">
					<div class="card-head">
						<i><AppIcon name="crew" /></i>
						<div>
							<small>{showNew ? 'Neues Konto' : 'Benutzerkonto'}</small>
							<h2>Allgemeine Angaben</h2>
						</div>
						<label class="active-switch"
							><input type="checkbox" bind:checked={draft.active} /><span>Aktiv</span></label
						>
					</div>
					<div class="fields">
						<label
							>Anzeigename<input bind:value={draft.displayName} placeholder="Vor- und Nachname" /></label
						><label>Benutzername<input bind:value={draft.username} placeholder="Benutzername" /></label
						><label
							>Rolle<select
								value={draft.role}
								onchange={(event) => setRole(event.currentTarget.value as UserRole)}
								>{#each Object.entries(roleLabels) as [value, label]}<option {value}>{label}</option
									>{/each}</select
							></label
						><label
							>Telegram User-ID<input
								bind:value={draft.telegramUserId}
								placeholder="Wird später für 2FA verwendet"
							/></label
						>
					</div>
					<p class="security-note">
						Passwörter und Telegram-Tokens werden hier nicht im Browser gespeichert. Diese Felder
						übernimmt später die geschützte Server-API.
					</p>
				</section>
				<section class="editor-card">
					<div class="card-head">
						<i><AppIcon name="list" /></i>
						<div>
							<small>Berechtigungen</small>
							<h2>Sichtbare Bereiche</h2>
						</div>
						<b>{draft.permissions.length}/{areas.length}</b>
					</div>
					<div class="permission-grid">
						{#each areas as area}<label class:checked={draft.permissions.includes(area.id)}
								><input
									type="checkbox"
									checked={draft.permissions.includes(area.id)}
									onchange={() => (draft.permissions = toggle(draft.permissions, area.id))}
								/><i>✓</i><span
									><strong>{area.label}</strong><small
										>{area.id === 'users'
											? 'Nur für Administratoren empfohlen'
											: 'Bereich anzeigen und öffnen'}</small
									></span
								></label
							>{/each}
					</div>
				</section>
				<section class="editor-card">
					<div class="card-head">
						<i><AppIcon name="vehicle" /></i>
						<div>
							<small>Flottenzugriff</small>
							<h2>Sichtbare Fahrzeuge</h2>
						</div>
						<b>{draft.vehicleIds.length ? draft.vehicleIds.length : 'Alle'}</b>
					</div>
					<p class="vehicle-hint">
						Ohne Auswahl darf der Benutzer alle Fahrzeuge sehen. Wähle Fahrzeuge aus, um den Zugriff
						einzuschränken.
					</p>
					<div class="vehicle-permissions">
						{#each vehicles as vehicle}<label class:checked={draft.vehicleIds.includes(vehicle.id)}
								><input
									type="checkbox"
									checked={draft.vehicleIds.includes(vehicle.id)}
									onchange={() => (draft.vehicleIds = toggle(draft.vehicleIds, vehicle.id))}
								/><i><AppIcon name="vehicle" size={17} /></i><span
									><strong>{vehicle.name}</strong><small>{vehicle.callSign}</small></span
								></label
							>{/each}
					</div>
				</section>
				<div class="savebar">
					<span class:visible={saved || dirty}
						>{saved ? '✓ Benutzer gespeichert' : dirty ? '● Ungespeicherte Änderungen' : ''}</span
					><button disabled={!dirty || !draft.username.trim()} onclick={save}
						>{dirty ? 'Benutzer speichern' : 'Alles gespeichert'}</button
					>
				</div>
			</div>{/if}
	</div>
</section>

<style>
	.users-page {
		min-height: 0;
		overflow: auto;
		padding: 32px max(28px, calc((100vw - 1480px) / 2)) 48px;
		background: radial-gradient(circle at 50% -25%, #dededb, #c8c8c5 65%);
		color: #575756;
	}
	.page-head {
		margin-bottom: 25px;
		display: flex;
		justify-content: space-between;
		align-items: end;
	}
	.page-head p,
	.card-head small,
	.list-head small {
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
	.page-head > button {
		height: 43px;
		padding: 0 16px;
		border: 0;
		border-radius: 7px;
		background: #e30613;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}
	.users-layout {
		display: grid;
		grid-template-columns: 310px minmax(0, 1fr);
		gap: 20px;
	}
	.user-list,
	.editor-card {
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
		overflow: hidden;
	}
	.user-list {
		height: max-content;
	}
	.list-head {
		padding: 20px;
		border-bottom: 4px solid #ffed00;
	}
	.list-head strong {
		display: block;
	}
	.user-list > button {
		width: 100%;
		padding: 14px 16px;
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
	.user-list > button.active {
		background: #f5f5f3;
		box-shadow: inset 4px 0 #e30613;
	}
	.user-list > button > i {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #e30613;
		color: #ffed00;
		font-size: 9px;
		font-style: normal;
		font-weight: 700;
	}
	.user-list span strong,
	.user-list span small {
		display: block;
	}
	.user-list span small {
		margin-top: 3px;
		color: #888;
		font-size: 9px;
	}
	.user-list em {
		padding: 5px 7px;
		border-radius: 15px;
		background: #e8f6f0;
		color: #16855b;
		font-size: 8px;
		font-style: normal;
	}
	.user-list em.inactive {
		background: #eee;
		color: #777;
	}
	.user-editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}
	.editor-card {
		padding: 22px;
	}
	.editor-card:first-child,
	.savebar {
		grid-column: 1/-1;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 18px;
	}
	.card-head > i {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: #e30613;
		color: #ffed00;
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
		font-size: 10px;
	}
	.active-switch {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 10px;
		font-weight: 700;
	}
	.active-switch input {
		width: 18px;
		height: 18px;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.fields label {
		font-size: 10px;
		font-weight: 700;
	}
	.fields input,
	.fields select {
		width: 100%;
		height: 42px;
		margin-top: 7px;
		padding: 0 12px;
		border: 1px solid #d3d3d0;
		border-radius: 7px;
		background: #fafafa;
		color: #575756;
	}
	.security-note,
	.vehicle-hint {
		margin: 15px 0 0;
		padding: 11px 13px;
		border-radius: 7px;
		background: #fff7d4;
		color: #756100;
		font-size: 9px;
		line-height: 1.5;
	}
	.permission-grid,
	.vehicle-permissions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.permission-grid > label,
	.vehicle-permissions > label {
		min-height: 56px;
		padding: 10px;
		border: 1px solid #dededc;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}
	.permission-grid > label.checked,
	.vehicle-permissions > label.checked {
		border-color: #e30613;
		background: #e3061308;
	}
	.permission-grid input,
	.vehicle-permissions input {
		position: absolute;
		opacity: 0;
	}
	.permission-grid label > i,
	.vehicle-permissions label > i {
		display: grid;
		place-items: center;
		width: 31px;
		height: 31px;
		border-radius: 6px;
		background: #eee;
		color: #aaa;
		font-style: normal;
	}
	.permission-grid label.checked > i,
	.vehicle-permissions label.checked > i {
		background: #e30613;
		color: #ffed00;
	}
	.permission-grid strong,
	.permission-grid small,
	.vehicle-permissions strong,
	.vehicle-permissions small {
		display: block;
	}
	.permission-grid strong,
	.vehicle-permissions strong {
		font-size: 10px;
	}
	.permission-grid small,
	.vehicle-permissions small {
		margin-top: 3px;
		color: #888;
		font-size: 8px;
	}
	.vehicle-hint {
		margin: 0 0 12px;
		background: #f2f2f0;
		color: #777;
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
		padding: 0 16px;
		border: 0;
		border-radius: 7px;
		background: #ffed00;
		color: #575756;
		font-size: 10px;
		font-weight: 700;
	}
	.savebar button:disabled {
		opacity: 0.45;
	}
	@media (max-width: 1000px) {
		.users-layout {
			grid-template-columns: 1fr;
		}
		.user-list {
			display: flex;
			overflow: auto;
		}
		.list-head {
			min-width: 150px;
		}
		.user-list > button {
			min-width: 230px;
		}
		.user-editor {
			grid-template-columns: 1fr;
		}
		.editor-card:first-child,
		.savebar {
			grid-column: auto;
		}
	}
	@media (max-width: 650px) {
		.users-page {
			padding: 18px 12px 28px;
		}
		.page-head {
			align-items: start;
		}
		.page-head h1 {
			font-size: 27px;
		}
		.page-head span {
			max-width: 230px;
			line-height: 1.4;
		}
		.page-head > button {
			padding: 0 11px;
		}
		.user-list {
			margin: 0 -12px;
			border-radius: 0;
		}
		.list-head {
			display: none;
		}
		.fields,
		.permission-grid,
		.vehicle-permissions {
			grid-template-columns: 1fr;
		}
		.editor-card {
			padding: 17px;
		}
		.savebar {
			bottom: 4px;
			justify-content: space-between;
		}
		.savebar span {
			font-size: 9px;
		}
	}
</style>
