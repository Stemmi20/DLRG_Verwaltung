/*
 * Die Beschriftungen des Papiervordrucks an einer Stelle. Server und Seite
 * greifen beide hierauf zu, damit die Texte nicht auseinanderlaufen.
 */

export const KONTROLLPUNKTE_LINKS = [
	{ id: 'motorenoel', label: 'Motorenöl' },
	{ id: 'kuehlwasser', label: 'Kühlwasser' },
	{ id: 'motorvorwaermung', label: 'Motorvorwärmung' },
	{ id: 'motorkontrollanzeige', label: 'Motorkontrollanzeige' },
	{ id: 'sicherungen', label: 'Sicherungen' },
	{ id: 'gps_radar_echolot', label: 'GPS/Radar/Echolot' },
	{ id: 'stromladekontrolle', label: 'Stromladekontrolle' }
] as const;

export const KONTROLLPUNKTE_RECHTS = [
	{ id: 'beleuchtung', label: 'Beleuchtung' },
	{ id: 'scheinwerfer', label: 'Scheinwerfer' },
	{ id: 'blaulicht', label: 'Blaulicht' },
	{ id: 'funkgeraet_2m', label: 'Funkgerät 2m' },
	{ id: 'handfunk_2m', label: 'Handfunk 2m' },
	{ id: 'funkgeraet_4m', label: 'Funkgerät 4m' },
	{ id: 'intercom', label: 'Intercom' },
	{ id: 'feuerloescher', label: 'Feuerlöscher' }
] as const;

export const ALARMIERUNG = [
	{ id: 'funkmeldeempfaenger', label: 'Funkmeldeempfänger' },
	{ id: 'funk', label: 'Funk' },
	{ id: 'eigene_beobachtung', label: 'eigene Beobachtung' }
] as const;

export const EINSATZARTEN = [
	{ id: 'rettung_aus_notlagen', label: 'Rettung von Personen aus Notlagen (Schwimmer, Surfer etc.)' },
	{ id: 'erste_hilfe_ohne_uebergabe', label: 'mit Maßnahmen der Erste Hilfe (keine Übergabe erforderlich)' },
	{ id: 'suchaktion_mit_booten', label: 'Suchaktion mit einem oder mehreren Booten' },
	{ id: 'bergung', label: 'Bergungen' },
	{ id: 'schlepphilfe', label: 'Schlepphilfen' },
	{ id: 'sicherung_veranstaltung', label: 'Sicherung von Veranstaltungen' },
	{
		id: 'erste_hilfe_ohne_notlage',
		label: 'Erste-Hilfe Maßnahmen bei Personen die nicht aus einer Notlage gerettet wurden'
	}
] as const;

export const FUNKTIONEN = [
	{ id: 'BF', label: 'BF – Bootsführer' },
	{ id: 'FU', label: 'FU – Funker' },
	{ id: 'WRH', label: 'WRH – Wasserrettungshelfer' },
	{ id: 'EH', label: 'EH – Sanitäter' }
] as const;

/** Die Zeilen des Wetterblocks, je Vormittag und Nachmittag. */
export const WETTERFELDER = [
	{ id: 'windstaerke', label: 'Windstärke' },
	{ id: 'windrichtung', label: 'Windrichtung' },
	{ id: 'seegang', label: 'Seegang' },
	{ id: 'wetter', label: 'Wetter' },
	{ id: 'lufttemp', label: 'Lufttemp.' },
	{ id: 'wassertemp', label: 'Wassertemp.' }
] as const;

export type WetterfeldId = (typeof WETTERFELDER)[number]['id'];