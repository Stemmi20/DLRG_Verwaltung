import type { Map as LeafletMap, Control, Layer, TileLayer } from 'leaflet';

/**
 * Wetter-Overlays vom Deutschen Wetterdienst.
 *
 * Der DWD stellt seine Geodaten als OGC-konforme WMS-Dienste bereit, die
 * Leaflet ohne Zusatzpaket versteht. Die Daten stehen unter CC BY 4.0 – der
 * Quellenvermerk ist Pflicht und steckt unten in `attribution`.
 *
 * Adresse: der MapProxy, nicht der GeoServer. Der DWD bittet ausdrücklich
 * darum, weil häufig abgerufene Produkte dort vorproduziert bereitliegen und
 * schneller ausgeliefert werden. Der Preis dafür: keine CQL-Filter.
 *
 * Ein Anspruch auf Verfügbarkeit besteht nicht, und der DWD behält sich vor,
 * Produktnamen jederzeit zu ändern. Fällt ein Layer aus, bleibt die Karte
 * trotzdem bedienbar – ein WMS-Layer, der nichts liefert, ist einfach leer.
 */

const DWD_WMS = 'https://maps.dwd.de/geoproxy/wms';

/** Kanton Thurgau, Amt für Geoinformation – Planquadrate des Bodensees. */
const TG_WMS = 'https://ows.geo.tg.ch/geofy_access_proxy/planquadrate_bodensee';

const QUELLE_DWD =
	'Wetterdaten: <a href="https://www.dwd.de" target="_blank" rel="noopener">DWD</a> (CC BY 4.0)';

const QUELLE_TG =
	'Planquadrate: <a href="https://geoinformation.tg.ch" target="_blank" rel="noopener">Kanton Thurgau, AGI</a>';

export interface WetterEbene {
	/** Beschriftung im Umschalter. */
	name: string;
	/** Layername im WMS-Dienst. */
	layer: string;
	/** Deckkraft – Radar darf kräftiger sein als eine Flächenfüllung. */
	deckkraft: number;
	/** Abweichender Dienst; ohne Angabe der DWD. */
	wms?: string;
	/** Abweichender Quellenvermerk; ohne Angabe der des DWD. */
	quelle?: string;

	standard?: boolean;
}

/**
 * Die Auswahl ist bewusst klein gehalten. Der DWD bietet weit über hundert
 * Layer; unter https://maps.dwd.de/geoserver/web/ lassen sie sich mit
 * Vorschau durchsehen, falls du weitere aufnehmen willst.
 */
export const WETTEREBENEN: WetterEbene[] = [
	/*
	 * Die Planquadrate liegen als Vektordaten in LV95 (CH1903+) vor. Über den
	 * WMS rechnet der Server sie in die Projektion der Karte um – deshalb hier
	 * als Kachelbild und nicht als GeoJSON.
	 */
	{
		name: 'Planquadrate Bodensee',
		layer: 'planquadrate_bodensee',
		deckkraft: 0.5,
		wms: TG_WMS,
		quelle: QUELLE_TG,
		standard: true
	},
	{ name: 'Niederschlagsradar', layer: 'dwd:Niederschlagsradar', deckkraft: 0.65 },
	{ name: 'Unwetterwarnungen', layer: 'dwd:Warnungen_Gemeinden_vereinigt', deckkraft: 0.45 },
	{ name: 'Wind 10 m', layer: 'dwd:ICON_D2_10m_Windgeschwindigkeit', deckkraft: 0.5 },
	{ name: 'Temperatur 2 m', layer: 'dwd:ICON_D2_2m_Temperatur', deckkraft: 0.5 }
];

/**
 * Hängt einen Umschalter oben rechts an die Karte. Die Ebenen lassen sich
 * einzeln an- und abschalten und beliebig übereinanderlegen – Leaflet
 * stapelt sie in der Reihenfolge, in der sie hinzugefügt werden.
 *
 * Gibt eine Funktion zurück, die den Umschalter wieder entfernt.
 */
export function wetterUmschalter(
	L: typeof import('leaflet'),
	karte: LeafletMap,
	/** Weitere Ebenen für denselben Umschalter, z. B. die Planquadrate. */
	zusatz: Record<string, Layer> = {},
	ebenen: WetterEbene[] = WETTEREBENEN
): () => void {
	const nachName: Record<string, Layer> = {};

		for (const ebene of ebenen) {
		const schicht = L.tileLayer.wms(ebene.wms ?? DWD_WMS, {
			layers: ebene.layer,
			// Ohne transparent: true deckt die Kachel die Grundkarte zu.
			transparent: true,
			format: 'image/png',
			version: '1.3.0',
			opacity: ebene.deckkraft,
			attribution: ebene.quelle ?? QUELLE_DWD,
			// Über der Grundkarte, unter Markern und Route.
			pane: 'overlayPane'
		});

		nachName[ebene.name] = schicht;

		// Vorausgewählt: eine Ebene, die schon an der Karte hängt, zeigt der
		// Umschalter automatisch angehakt.
		if (ebene.standard) schicht.addTo(karte);
	}

	// Zusatzebenen zuerst: sie stehen im Umschalter oben und liegen unter
	// den Wetterflächen.
	const alle: Record<string, Layer> = { ...zusatz, ...nachName };

	const umschalter: Control.Layers = L.control
		.layers(undefined, alle, { collapsed: true, position: 'topright' })
		.addTo(karte);

	return () => {
		for (const schicht of Object.values(alle)) karte.removeLayer(schicht);
		umschalter.remove();
	};
}

/**
 * Radarbilder veralten schnell. Diese Funktion lädt die sichtbaren
 * WMS-Ebenen neu, ohne sie ab- und wieder anzuschalten.
 *
 * Aufrufen etwa alle fünf Minuten – öfter lohnt nicht, das Radarprodukt
 * wird in diesem Takt aktualisiert.
 */
export function ebenenAktualisieren(karte: LeafletMap): void {
	karte.eachLayer((schicht) => {
		// redraw gibt es nur auf Kachelebenen, nicht auf Markern.
		const kachel = schicht as TileLayer;
		if (typeof kachel.redraw === 'function' && 'wmsParams' in kachel) kachel.redraw();
	});
}