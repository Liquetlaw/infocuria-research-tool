# Research tool for InfoCuria (unofficial) · Version 1.1.0

Chrome-Erweiterung für die Dokumentseiten der InfoCuria-Rechtsprechungsdatenbank (`juris.curia.europa.eu/juris/document/…`).

- **Fundstelle kopieren:** Doppelklick auf eine Randnummer. Markierter Text lässt sich mit Fundstelle kopieren.
- **Verweise:** Jede ECLI im Text ist anklickbar; ein Fenster zeigt die zitierte Randnummer, live von InfoCuria.
  Die Stelle erscheint in der Sprache des geöffneten Dokuments; gibt es diese Fassung nicht, auf Englisch, sonst in
  der Verfahrenssprache des zitierten Verfahrens (laut „Detaillierte Angaben“). Eine andere Sprache wird im Fenster angegeben.
- **Seitenbereich:** Klick auf das Symbol der Erweiterung öffnet rechts einen Seitenbereich von Chrome (die Seite
  rückt zur Seite): Zitierstil, verbundenes Verfahren, andere Dokumente, „Wer zitiert diese Entscheidung?“,
  Gliederung. Am besten das Symbol über das Puzzle-Symbol der Symbolleiste anheften.
- **Zitierstil:** sechs Vorlagen (Deutsch Standard/wie der Gerichtshof/kurz, Englisch Standard/wie der Gerichtshof,
  OSCOLA). Unter „Bausteine anpassen“ lässt sich jeder Baustein (Gericht, Art und Datum, Bezeichnung, Aktenzeichen,
  ECLI, Randnummer) ein- und ausschalten, verschieben, in seiner Form ändern und mit einem anderen Trenner versehen.
  Dazu: Stellung des markierten Textes und Art der Anführungszeichen. Solange man nichts selbst wählt, folgt der
  Zitierstil der Sprache der Oberfläche.
- **Sprache:** oben im Seitenbereich „Sprache wie die Seite / Deutsch / English“.
- **Sprachfassungen:** Die Erweiterung arbeitet auf jeder Sprachfassung, die InfoCuria als Text anbietet.
- **Woher die Angaben kommen:**
  - *Art:* aus der Zeile des Dokuments in der deutschen, sonst der englischen Verfahrensübersicht von InfoCuria; ist sie
    dort nicht zu finden, aus der Titelzeile des Textes (nur deutsche, englische oder französische Fassung).
  - *Bezeichnung und Aktenzeichen:* aus der Rechtssache, in der die ECLI des Dokuments steht. Bei Schlussanträgen und
    Stellungnahmen aus der Aktenzeichen-Zeile im Kopf des Dokuments („Rechtssache …“ / „Case …“ / „Affaire …“) oder,
    wenn die Entscheidung dort genau ein passendes Aktenzeichen nennt, aus der Übersicht – nicht aus der Angabe einer
    späteren Verbindung. Die Bezeichnung steht bei Schlussanträgen und Stellungnahmen nur, wenn die Rechtssache genau
    diese eine Sache bezeichnet (sonst bleibt sie leer, mit Hinweis).
  - *Datum von Urteilen, Beschlüssen und Gutachten:* aus der Übersicht. Ist die Seite deutsch, englisch oder französisch,
    wird es mit dem Kopf des Textes verglichen; nennt die Übersicht kein Datum, kommt es aus dem Kopf einer deutschen,
    französischen oder englischen Fassung desselben Dokuments.
  - *Datum von Schlussanträgen und Stellungnahmen:* nur aus dem Kopf einer deutschen, englischen oder französischen
    Fassung desselben Dokuments.
  - *Generalanwalt/Generalanwältin:* Schreibweise aus den „Detaillierten Angaben“ des Verfahrens bei InfoCuria; sonst
    der Name aus dem Kopf des Dokuments (bevorzugt englische Fassung, sonst die geöffnete Seite in ihrer Sprache, dann
    die deutsche oder französische Fassung). Widersprechen sich die „Detaillierten Angaben“ und der Kopf des Dokuments,
    gilt der Name aus dem Kopf. „Generalanwältin“/„Generalanwalt“ nur aus dem deutschen oder
    französischen Titel; sonst neutral „GA …“.
- **Nichts wird geraten:** Lässt sich eine Angabe nicht sicher lesen (z. B. Übersicht nicht erreichbar, Art der
  Entscheidung unklar, Daten widersprechen sich), bleibt der Baustein leer. Beim Kopieren und im Seitenbereich steht
  dann „Unvollständig: …“ mit dem fehlenden Baustein. Ist das Geschlecht nicht lesbar, heißt es neutral „GA …“.

## Installieren zum Ausprobieren (Chrome ab Version 116)
1. In Chrome `chrome://extensions` öffnen.
2. Oben rechts „Entwicklermodus“ einschalten.
3. „Entpackte Erweiterung laden“ wählen und diesen Ordner auswählen.

Nach einer Änderung an den Dateien auf der Erweiterungsseite den Neu-laden-Pfeil drücken.

## Dateien
- `manifest.json`, `_locales/` – Beschreibung der Erweiterung (deutsch/englisch)
- `lesen.js` – liest Randnummern, Kopfdaten, Verfahrensübersicht (reine Lesefunktionen)
- `zitierstil.js` – Bausteine, Formen und Vorlagen der Fundstelle
- `content.js`, `content.css` – Wirkung auf der Urteilsseite (Kopieren, Verweise, Vorschau)
- `panel.html`, `panel.js`, `panel.css` – Seitenbereich
- `hintergrund.js` – öffnet den Seitenbereich beim Klick auf das Symbol
- `icons/` – Symbole

## Grenzen
- Verweise werden über die ECLI erkannt (Entscheidungen seit etwa 2014 zitieren so).
- Randnummern werden in drei Formaten erkannt: Anker im Text (`<a name="point53">`), altes Format mit Nummernliste
  (`<dt>53.</dt><dd>…</dd>`) und Absätze, die mit der Nummer beginnen (z. B. „1.“ in Schlussanträgen um 2008; nur
  lückenlos ab 1). Sehr alte Entscheidungen haben teils keine Randnummern; dann gibt es nur die Fundstelle ohne Randnummer.
- Gibt es ein Dokument in der gewählten Sprache nicht als Text (die Seite meldet „nicht verfügbar“), richtet die
  Erweiterung auf dieser Seite nichts ein; der Seitenbereich sagt das und bietet nichts zum Kopieren an.
- Sie setzt auf die bisherige InfoCuria-Oberfläche. Ändert der Gerichtshof diese Seiten, muss sie angepasst werden.
- Alle Angaben stammen von der Seite selbst und aus InfoCuria; die Erweiterung sendet nichts an Dritte.
