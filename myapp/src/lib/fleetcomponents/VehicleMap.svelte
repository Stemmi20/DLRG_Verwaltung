<script lang="ts">
	import { onMount } from 'svelte';
	import type { CircleMarker, Map as LeafletMap, Marker, Polyline } from 'leaflet';
	import type { RoutePoint, Vehicle } from '$lib/fleet/types';
	let {
		vehicles,
		selectedId,
		onselect,
		center = null,
		zoom = null,
		routePoints = [],
		showRoute = false,
	}: {
		vehicles: Vehicle[];
		selectedId: string;
		onselect: (id: string) => void;
		center?: [number, number] | null;
		zoom?: number | null;
		routePoints?: RoutePoint[];
		showRoute?: boolean;
	} = $props();
	let element: HTMLDivElement,
		map: LeafletMap | undefined,
		L: typeof import('leaflet'),
		routeLine: Polyline | undefined,
		userMarker: CircleMarker | undefined;
	const markers = new Map<string, Marker>();
	function icon(v: Vehicle) {
		return L.divIcon({
			className: '',
			html: `<div class="${v.status}"><span><img src="/PB3941.ico" alt="Hugo Eckener" style="height: 75px; width: 75px;"/></span></div>`,
			iconSize: [55, 55],
			iconAnchor: [18, 34],
		});
	}
	function hasPosition(vehicle: Vehicle): vehicle is Vehicle & { lat: number; lng: number } {
		return Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng);
	}
	function sync(): void {
		if (!map || !L) return;
		for (const v of vehicles) {
			if (!hasPosition(v)) continue;
			let m = markers.get(v.id);
			if (!m) {
				m = L.marker([v.lat, v.lng], { icon: icon(v) })
					.addTo(map)
					.on('click', () => onselect(v.id));
				markers.set(v.id, m);
			}
			m.setLatLng([v.lat, v.lng]);
			m.setIcon(icon(v));
			m.bindPopup(
				`<strong>${v.name}</strong><p>${v.address}</p><small>Aktualisiert: ${v.updated}</small>`,
			);
		}
	}
	function syncRoute(): void {
		if (!map || !L) return;
		if (routeLine) {
			routeLine.remove();
			routeLine = undefined;
		}
		if (showRoute && routePoints.length > 1)
			routeLine = L.polyline(
				routePoints.map((point) => [point.lat, point.lng]),
				{ color: '#e30613', weight: 5, opacity: 0.9, lineJoin: 'round' },
			).addTo(map);
	}
	export function focus(id: string): void {
		const v = vehicles.find((x) => x.id === id);
		if (v && hasPosition(v) && map) {
			map.flyTo([v.lat, v.lng], 16, { duration: 0.7 });
			markers.get(id)?.openPopup();
		}
	}
	export function fit(): void {
		const positioned = vehicles.filter(hasPosition);
		if (map && positioned.length)
			map.fitBounds(L.latLngBounds(positioned.map((v) => [v.lat, v.lng])), { padding: [50, 50] });
	}
	export function locate(): void {
		if (!navigator.geolocation || !map) return;
		navigator.geolocation.getCurrentPosition((position) => {
			const point: [number, number] = [position.coords.latitude, position.coords.longitude];
			if (userMarker) userMarker.setLatLng(point);
			else
				userMarker = L.circleMarker(point, {
					radius: 8,
					color: '#fff',
					weight: 3,
					fillColor: '#1685d1',
					fillOpacity: 1,
				})
					.addTo(map!)
					.bindPopup('Mein Standort');
			map!.flyTo(point, 16, { duration: 0.7 });
			userMarker.openPopup();
		});
	}
	$effect(() => {
		vehicles;
		sync();
	});
	$effect(() => {
		routePoints;
		showRoute;
		syncRoute();
	});
	onMount(() => {
		let cancelled = false;
		void (async () => {
			L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
			if (cancelled) return;
			map = L.map(element);
			if (Array.isArray(center) && center.length === 2) map.setView(center, zoom ?? 13);
			else map.fitWorld();
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap-Mitwirkende',
			}).addTo(map);
			sync();
			syncRoute();
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});
</script>

<div class="map" bind:this={element}></div>

<style>
	.map {
		position: absolute;
		inset: 0;
		background: #dbe2df;
	}
	:global(.pin) {
		width: 36px;
		height: 36px;
		border-radius: 50% 50% 50% 0;
		transform: rotate(-45deg);
		border: 3px solid #fff;
		box-shadow: 0 3px 10px #0005;
		background: #e30613;
		display: grid;
		place-items: center;
	}
	:global(.pin span) {
		transform: rotate(45deg);
		color: #ffed00;
		font-size: 13px;
	}
	:global(.pin.mission) {
		background: #e98212;
	}
	:global(.pin.offline) {
		background: #7f8990;
	}
	:global(.leaflet-popup-content p) {
		margin: 5px 0;
		color: #575756;
	}
</style>
