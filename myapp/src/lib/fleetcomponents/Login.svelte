<script lang="ts">
	const baseUrl = import.meta.env.BASE_URL;
	let {
		logoUrl = `${baseUrl}friedrichshafen.svg`,
		heroUrl = `${baseUrl}login-fleetmap.png`,
	}: {
		logoUrl?: string;
		heroUrl?: string;
	} = $props();
	let username = $state('');
	let password = $state('');
	let reveal = $state(false);
	let error = $state('');

	function submit() {
		if (error) password = '';
	}
</script>

<main class="login">
	<section class="panel">
		<div class="panel-top">
			<img class="logo" src={logoUrl} alt="DLRG Friedrichshafen" />
		</div>

		<div class="login-card">
			<div class="card-accent"></div>
			<img
				class="fleetmap-mark"
				src={`${baseUrl}dlrg-fn-fleetmap.png`}
				alt="DLRG Friedrichshafen Fleetmap"
			/>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<label for="user">Benutzername</label>
				<div class="field">
					<span class="field-icon" aria-hidden="true">●</span>
					<input
						id="user"
						bind:value={username}
						autocomplete="username"
						placeholder="Benutzername eingeben"
						required
					/>
				</div>

				<label for="pass">Passwort</label>
				<div class="field password">
					<span class="field-icon lock" aria-hidden="true">◆</span>
					<input
						id="pass"
						bind:value={password}
						type={reveal ? 'text' : 'password'}
						autocomplete="current-password"
						placeholder="Passwort eingeben"
						required
					/>
					<button type="button" onclick={() => (reveal = !reveal)}
						>{reveal ? 'Ausblenden' : 'Anzeigen'}</button
					>
				</div>

				<p class="error" role="alert">{error}</p>
				<button class="submit" type="submit"><span>Anmelden</span><span class="arrow">→</span></button>
			</form>
		</div>

		<small class="legal"
			>DLRG Ortsgruppe Friedrichshafen · Gepfuscht von Moritz und Nico :) Getestet und für gut befunden
			von Lena.</small
		>
	</section>

	<aside class="photo">
		<img src={heroUrl} alt="Fleetmap mit Wasserrettungsboot auf dem Bodensee" />
		<div class="shade"></div>
	</aside>
</main>

<style>
	.login {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(500px, 42%) 1fr;
		background: #e30613;
		color: #575756;
	}
	.panel {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 105px clamp(45px, 6vw, 110px) 62px;
		background: #e30613;
	}
	.panel:after {
		content: '';
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: #ffed00;
	}
	.panel-top {
		position: absolute;
		top: 35px;
		left: clamp(45px, 6vw, 110px);
		right: clamp(45px, 6vw, 110px);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.logo {
		width: 130px;
		height: auto;
	}
	.login-card {
		position: relative;
		width: 100%;
		max-width: 510px;
		padding: 42px 48px 30px;
		border: 0;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 28px 70px rgba(87, 87, 86, 0.35);
		overflow: hidden;
	}
	.card-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		background: #ffed00;
	}
	form {
		width: 100%;
	}
	label {
		display: block;
		margin: 14px 0 7px;
		color: #575756;
		font-size: 11px;
		font-weight: 700;
	}
	.field {
		height: 52px;
		display: flex;
		align-items: center;
		border: 1px solid #cfcfce;
		border-radius: 6px;
		background: #fff;
		transition: 0.18s;
	}
	.field:focus-within {
		border-color: #e30613;
		box-shadow: 0 0 0 3px #e3061313;
	}
	.field-icon {
		display: grid;
		place-items: center;
		width: 44px;
		color: #575756;
		font-size: 7px;
	}
	.field-icon.lock {
		font-size: 9px;
	}
	.field input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: #575756;
		font: inherit;
		font-size: 13px;
	}
	.password input {
		padding-right: 4px;
	}
	.password button {
		height: 36px;
		margin-right: 7px;
		padding: 0 9px;
		border: 0;
		background: none;
		color: #575756;
		font-size: 10px;
	}
	.error {
		min-height: 16px;
		margin: 8px 0 0;
		color: #e30613;
		font-size: 11px;
	}
	.submit {
		width: 100%;
		height: 52px;
		margin-top: 9px;
		padding: 0 8px 0 18px;
		border: 0;
		border-radius: 6px;
		background: #e30613;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 700;
		box-shadow: 0 10px 22px #e3061326;
		transition: 0.18s;
	}
	.submit:hover {
		background: #c9000d;
		transform: translateY(-1px);
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 4px;
		background: #ffed00;
		color: #575756;
		font-size: 18px;
	}
	.legal {
		position: absolute;
		bottom: 23px;
		left: 0;
		right: 0;
		text-align: center;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2px;
	}
	.photo {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		background: #575756;
	}
	.photo > img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		image-rendering: auto;
	}
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 55%, rgba(87, 87, 86, 0.58) 100%);
	}
	@media (max-width: 1050px) {
		.login {
			grid-template-columns: minmax(470px, 50%) 1fr;
		}
		.login-card {
			padding: 38px;
		}
	}
	@media (max-width: 780px) {
		.login {
			grid-template-columns: 1fr;
		}
		.photo {
			display: none;
		}
		.panel {
			min-height: 100vh;
			padding: 100px 24px 55px;
		}
		.panel-top {
			left: 24px;
			right: 24px;
		}
		.login-card {
			padding: 36px 28px 28px;
		}
	}
	.fleetmap-mark {
		display: block;
		width: 215px;
		height: 215px;
		margin: -29px auto 12px;
		object-fit: contain;
	}
	@media (max-width: 780px) {
		.panel {
			overflow: auto;
			justify-content: flex-start;
		}
		.login-card {
			margin: auto 0;
		}
		.legal {
			position: static;
			margin: 22px 0 0;
			line-height: 1.45;
		}
		.fleetmap-mark {
			width: min(190px, 58vw);
			height: min(190px, 58vw);
		}
	}
	@media (max-height: 760px) {
		.fleetmap-mark {
			width: 150px;
			height: 150px;
			margin: -26px auto 5px;
		}
		.login-card {
			padding-top: 32px !important;
			padding-bottom: 23px !important;
		}
	}
</style>
