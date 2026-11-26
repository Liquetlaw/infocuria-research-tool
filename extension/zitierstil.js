// Zitierstil: Bausteine einer Fundstelle und ihre Formen. Wird von content.js (Seite) und panel.js (Seitenbereich)
// gemeinsam benutzt, damit Vorschau und kopierte Fundstelle immer gleich aussehen.
// Fehlt eine Angabe, bleibt der Baustein leer – es wird nie etwas eingesetzt, das nicht von InfoCuria stammt.
(() => {
  "use strict";
  const MONATE = {
    de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const d2 = (n) => String(n).padStart(2, "0");
  const datum = {
    de_lang: (d) => `${d.tag}. ${MONATE.de[d.monat]} ${d.jahr}`,
    de_ziffern: (d) => `${d.tag}.${d.monat + 1}.${d.jahr}`,
    en: (d) => `${d.tag} ${MONATE.en[d.monat]} ${d.jahr}`,
    iso: (d) => `${d.jahr}-${d2(d.monat + 1)}-${d2(d.tag)}`,
  };
  const GERICHT = {
    de_kurz: { C: "EuGH", T: "EuG", F: "EuGöD" },
    de_lang: { C: "Gerichtshof", T: "Gericht", F: "Gericht für den öffentlichen Dienst" },
    en_kurz: { C: "CJEU", T: "General Court", F: "Civil Service Tribunal" },
    en_lang: { C: "Court of Justice", T: "General Court", F: "Civil Service Tribunal" },
  };
  // Art der Entscheidung mit Datum. ga: Generalanwalt (nur Schlussanträge und Stellungnahmen).
  const ART = {
    urteil: { de: "Urteil", de_k: "Urt.", en: "judgment", en_g: "Judgment" },
    beschluss: { de: "Beschluss", de_k: "Beschl.", en: "order", en_g: "Order" },
    gutachten: { de: "Gutachten", de_k: "Gutachten", en: "Opinion", en_g: "Opinion" },
    sa: { de: "Schlussanträge", de_k: "SchlA", en: "Opinion", en_g: "Opinion" },
    stellungnahme: { de: "Stellungnahme", de_k: "Stellungn.", en: "View", en_g: "View" },
  };
  const MIT_GA = (a) => a === "sa" || a === "stellungnahme";
  // Formen der Art, die beim Gutachten die Nummer schon enthalten („Gutachten 2/13 vom …“)
  const ART_MIT_NR = ["de_lang", "de_ziffern", "de_kurz", "en", "en_gross"];
  function artDatum(t, form) {
    let a = ART[t.art];
    if (!a) return "";                                         // Art unbekannt: Baustein leer, nie „Urteil“ (K1)
    const d = t.datum;
    const ga = MIT_GA(t.art) && t.ga;
    // Geschlecht unbekannt → neutrale Form „GA X“ (K9)
    const gaDe = t.gaWeiblich === true ? "der Generalanwältin" : t.gaWeiblich === false ? "des Generalanwalts" : "GA";
    if (t.art === "gutachten" && t.gutachtenNr) {                      // „Gutachten 2/13 vom 18. Dezember 2014“
      a = { de: `Gutachten ${t.gutachtenNr}`, de_k: `Gutachten ${t.gutachtenNr}`, en: `Opinion ${t.gutachtenNr}`, en_g: `Opinion ${t.gutachtenNr}` };
    }
    switch (form) {
      case "de_lang": return `${a.de}${ga ? ` ${gaDe} ${t.ga}` : ""}${d ? " vom " + datum.de_lang(d) : ""}`;
      case "de_kurz": return `${a.de_k}${ga ? ` GA ${t.ga}` : ""}${d ? " v. " + datum.de_ziffern(d) : ""}`;
      case "de_ziffern": return `${a.de}${ga ? ` ${gaDe} ${t.ga}` : ""}${d ? " vom " + datum.de_ziffern(d) : ""}`;
      case "en": return `${a.en}${ga ? ` of Advocate General ${t.ga}` : ""}${d ? " of " + datum.en(d) : ""}`;
      case "en_gross": return `${a.en_g}${ga ? ` of Advocate General ${t.ga}` : ""}${d ? " of " + datum.en(d) : ""}`;
      case "datum_de": return d ? datum.de_lang(d) : "";
      case "datum_en": return d ? datum.en(d) : "";
      case "datum_iso": return d ? datum.iso(d) : "";
      case "jahr": return d ? `[${d.jahr}]` : "";
      // OSCOLA: „[2019]“, „[2023] (order)“; der Zusatz „Opinion of AG …“ kommt in formatiere hinzu (K10)
      case "oscola": return [d ? `[${d.jahr}]` : "", t.art === "beschluss" ? "(order)" : ""].filter(Boolean).join(" ");
      default: return "";
    }
  }
  // nr: Zahl oder Bereich { von, bis } (markierter Text über mehrere Absätze)
  function randnummer(t, nr, form) {
    if (!nr) return "";
    const sa = MIT_GA(t.art);                                  // Schlussanträge/Stellungnahmen sind nach Nummern gegliedert
    if (typeof nr === "object") {
      if (!nr.von || !nr.bis) return "";
      const de = (w) => `${w} ${nr.von} bis ${nr.bis}`, en = (w) => `${w} ${nr.von} to ${nr.bis}`;
      return ({
        rn: de(sa ? "Nrn." : "Rn."), rz: de(sa ? "Nrn." : "Rz."), randnr: de(sa ? "Nrn." : "Randnrn."),
        para: en(sa ? "points" : "paras."), para_ohne: en(sa ? "points" : "paras"), paragraph: en(sa ? "points" : "paragraphs"),
        eckig: `[${nr.von}]–[${nr.bis}]`,
      })[form] || de("Rn.");
    }
    return ({
      rn: sa ? `Nr. ${nr}` : `Rn. ${nr}`, rz: sa ? `Nr. ${nr}` : `Rz. ${nr}`, randnr: sa ? `Nr. ${nr}` : `Randnr. ${nr}`,
      para: sa ? `point ${nr}` : `para. ${nr}`, para_ohne: sa ? `point ${nr}` : `para ${nr}`,
      paragraph: sa ? `point ${nr}` : `paragraph ${nr}`, eckig: `[${nr}]`,
    })[form] || `Rn. ${nr}`;
  }
  // Aktenzeichen: Liste (verbundene Rechtssachen), Bereich { von, bis } („C-622/16 P bis C-624/16 P“, N2) oder Text
  // (ältere Daten). sp: Sprache des Stils für die Form „nur“; nur das Bindewort hängt von der Sprache ab.
  const azListe = (az) => (Array.isArray(az) ? az.filter(Boolean) : az && typeof az === "object" ? [az.von, az.bis].filter(Boolean) : az ? [az] : []);
  const verbinde = (l, sp) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + (sp === "en" ? " and " : " und ") + l[l.length - 1]);
  function azText(az, sp) {
    if (az && !Array.isArray(az) && typeof az === "object") return az.von && az.bis ? `${az.von} ${sp === "en" ? "to" : "bis"} ${az.bis}` : "";
    return verbinde(azListe(az), sp);
  }
  function aktenzeichen(t, f, kx) {
    const sp = f === "rs" ? "de" : f === "case" ? "en" : kx.sp;
    if (t.gutachtenNr) {                                       // Gutachtenverfahren: „Gutachten 2/13“ / „Opinion 2/13“ (K4)
      if (t.art === "gutachten" && kx.artNr) return "";        // steht schon in „Art und Datum“
      return `${sp === "en" ? "Opinion" : "Gutachten"} ${t.gutachtenNr}`;
    }
    const l = azListe(t.az);
    if (!l.length) return "";
    const s = azText(t.az, sp), v = l.length > 1;
    return f === "rs" ? `${v ? "verb. Rs." : "Rs."} ${s}` : f === "case" ? `${v ? "Joined Cases" : "Case"} ${s}` : s;
  }
  const BAUSTEINE = {
    gericht: { name: ["Gericht", "Court"], formen: { de_kurz: "EuGH / EuG", de_lang: "Gerichtshof / Gericht", en_kurz: "CJEU / General Court", en_lang: "Court of Justice / General Court" },
               wert: (t, nr, f) => (GERICHT[f] || GERICHT.de_kurz)[t.gericht] || "" },
    art: { name: ["Art und Datum", "Type and date"], formen: { de_lang: "Urteil vom 8. Mai 2019", de_ziffern: "Urteil vom 8.5.2019", de_kurz: "Urt. v. 8.5.2019", en: "judgment of 8 May 2019", en_gross: "Judgment of 8 May 2019", datum_de: "8. Mai 2019", datum_en: "8 May 2019", datum_iso: "2019-05-08", jahr: "[2019]", oscola: "[2023] (order)" },
           wert: (t, nr, f) => artDatum(t, f) },
    name: { name: ["Bezeichnung", "Case name"], formen: { de: "A/EZB (deutsch)", en: "A v ECB (englisch)" },
            wert: (t, nr, f) => (t.name || {})[f] || (t.name || {}).de || (t.name || {}).en || "" },
    az: { name: ["Aktenzeichen", "Case number"], formen: { nur: "C-450/17 P", rs: "Rs. C-450/17 P", case: "Case C-450/17 P" },
          wert: (t, nr, f, kx) => aktenzeichen(t, f, kx || { sp: "de", artNr: false }) },
    ecli: { name: ["ECLI", "ECLI"], formen: { voll: "ECLI:EU:C:2019:372", kurz: "EU:C:2019:372" },
            wert: (t, nr, f) => (t.ecli ? (f === "kurz" ? t.ecli.replace(/^ECLI:/, "") : t.ecli) : "") },
    rn: { name: ["Randnummer", "Paragraph"], formen: { rn: "Rn. 53", rz: "Rz. 53", randnr: "Randnr. 53", para: "para. 53", para_ohne: "para 53", paragraph: "paragraph 53", eckig: "[53]" },
          wert: (t, nr, f) => randnummer(t, nr, f) },
  };
  // Sprache eines Stils (für die Form „nur“ des Aktenzeichens: „und“ oder „and“): aus den Formen der Bausteine
  const SPRACHE_FORM = {
    art: { de_lang: "de", de_ziffern: "de", de_kurz: "de", datum_de: "de", en: "en", en_gross: "en", datum_en: "en", oscola: "en" },
    name: { de: "de", en: "en" }, gericht: { de_kurz: "de", de_lang: "de", en_kurz: "en", en_lang: "en" },
    rn: { rn: "de", rz: "de", randnr: "de", para: "en", para_ohne: "en", paragraph: "en" },
  };
  function kontext(stil) {
    const bl = stil?.bloecke || [];
    let sp = null;
    for (const nurAn of [true, false]) for (const k of ["art", "name", "gericht", "rn"]) {
      const x = bl.find((y) => y.k === k);
      if (!sp && x && (!nurAn || x.an)) sp = SPRACHE_FORM[k][x.form] || null;
    }
    const art = bl.find((x) => x.k === "art");
    return { sp: sp || "de", artNr: !!(art && art.an && ART_MIT_NR.includes(art.form)) };
  }
  const TRENNER = { ", ": ", ", " ": "␣ (Leerzeichen)", "; ": "; ", " – ": " – ", " (": " ( … )" };
  const b = (k, form, an = true, vor = ", ") => ({ k, form, an, vor });
  const VORLAGEN = {
    de_standard: { name: ["Deutsch – Standard", "German – standard"], stil: { bloecke: [b("gericht", "de_kurz"), b("art", "de_lang"), b("name", "de"), b("az", "nur"), b("ecli", "voll"), b("rn", "rn")], zitat: "vor", anf: "de" } },
    de_gerichtshof: { name: ["Deutsch – wie der Gerichtshof", "German – as the Court cites"], stil: { bloecke: [b("gericht", "de_kurz", false), b("art", "de_lang"), b("name", "de"), b("az", "nur", true, " ("), b("ecli", "kurz"), b("rn", "rn")], zitat: "vor", anf: "de" } },
    de_kurz: { name: ["Deutsch – kurz", "German – short"], stil: { bloecke: [b("gericht", "de_kurz"), b("art", "de_kurz"), b("name", "de", false), b("az", "rs"), b("ecli", "voll"), b("rn", "rn")], zitat: "vor", anf: "de" } },
    en_standard: { name: ["Englisch – Standard", "English – standard"], stil: { bloecke: [b("gericht", "en_kurz"), b("art", "en"), b("name", "en"), b("az", "nur"), b("ecli", "voll"), b("rn", "para")], zitat: "vor", anf: "en" } },
    en_gerichtshof: { name: ["Englisch – wie der Gerichtshof", "English – as the Court cites"], stil: { bloecke: [b("gericht", "en_kurz", false), b("art", "en"), b("name", "en"), b("az", "nur", true, " ("), b("ecli", "kurz"), b("rn", "paragraph")], zitat: "vor", anf: "en" } },
    oscola: { name: ["Englisch – OSCOLA", "English – OSCOLA"], stil: { bloecke: [b("az", "case"), b("name", "en", true, " "), b("art", "oscola", true, " "), b("ecli", "voll", true, " "), b("rn", "para_ohne"), b("gericht", "en_kurz", false)], zitat: "vor", anf: "en" } },
  };
  const kopie = (x) => JSON.parse(JSON.stringify(x));
  // Gültig: jeder Baustein genau einmal, jede Form bekannt (auch ältere gespeicherte Stile, z. B. OSCOLA mit „jahr“)
  function gueltig(stil) {
    if (!stil || !Array.isArray(stil.bloecke) || stil.bloecke.length !== Object.keys(BAUSTEINE).length) return false;
    const ks = stil.bloecke.map((x) => x && x.k);
    return new Set(ks).size === ks.length
      && stil.bloecke.every((x) => BAUSTEINE[x.k] && BAUSTEINE[x.k].formen[x.form] !== undefined && typeof x.vor === "string");
  }
  // Vergleich Feld für Feld: Chrome speichert Objekte mit sortierten Schlüsseln, ein Textvergleich trügt daher.
  const schluessel = (s) => JSON.stringify([s.bloecke.map((x) => [x.k, x.form, !!x.an, x.vor]), s.zitat, s.anf]);
  function vorlageVon(stil) {
    if (!gueltig(stil)) return null;
    const s = schluessel(stil);
    return Object.keys(VORLAGEN).find((k) => schluessel(VORLAGEN[k].stil) === s) || null;
  }
  // Die OSCOLA-Vorlage bis 1.0.0 (Art in der Form „jahr“) gilt als die heutige OSCOLA-Vorlage
  const ALT_OSCOLA = (() => { const s = kopie(VORLAGEN.oscola.stil); s.bloecke.find((x) => x.k === "art").form = "jahr"; return schluessel(s); })();
  // Grundeinstellung: folgt der Sprache der Oberfläche, bis man selbst etwas wählt (auto: true).
  const standard = (en) => ({ ...kopie(VORLAGEN[en ? "en_standard" : "de_standard"].stil), auto: true });
  function wirksam(stil, en) {
    if (!gueltig(stil) || stil.auto) return standard(en);
    // Ältere gespeicherte Stile ohne Kennzeichen: entspricht er einer Grundeinstellung, gilt er als solche.
    if (!("auto" in stil) && ["de_standard", "en_standard"].includes(vorlageVon(stil))) return standard(en);
    if (schluessel(stil) === ALT_OSCOLA) return { ...kopie(VORLAGEN.oscola.stil), ...("auto" in stil ? { auto: stil.auto } : {}) };
    return stil;
  }
  // Hinweise auf fehlende Angaben (Codes aus lesen.js bestimmeTeile), nur für eingeschaltete Bausteine
  const HINWEIS = {
    fehler: ["Angaben zur Entscheidung ließen sich nicht ermitteln", "Details of the decision could not be determined", null],
    ecli: ["ECLI nicht gefunden", "ECLI not found", null],
    uebersicht: ["Verfahrensübersicht von InfoCuria nicht erreichbar", "InfoCuria case overview could not be reached", null],
    zeile: ["ECLI steht nicht in der Verfahrensübersicht", "ECLI not listed in the case overview", null],
    art: ["Art der Entscheidung nicht ermittelt", "Type of decision not determined", "art"],
    datum: ["Datum nicht ermittelt", "Date not determined", "art"],
    ga: ["Generalanwalt/Generalanwältin nicht ermittelt", "Advocate General not determined", "art"],
    az: ["Aktenzeichen nicht ermittelt", "Case number not determined", "az"],
    name: ["Bezeichnung nicht ermittelt", "Case name not determined", "name"],
    seite: ["InfoCuria zeigt auf dieser Seite womöglich ein anderes Dokument als angefragt – bitte die Seite neu laden",
            "InfoCuria may be showing a different document than requested on this page – please reload the page", null],
    rn: ["Randnummer nicht ermittelt (Markierung außerhalb nummerierter Absätze)", "Paragraph number not determined (selection outside numbered paragraphs)", "rn"],
  };
  function hinweisTexte(teile, stil, en, extra = []) {
    const an = new Set((stil?.bloecke || []).filter((x) => x.an).map((x) => x.k));
    return [...(teile?.hinweise || []), ...extra].filter((c, i, a) => a.indexOf(c) === i && HINWEIS[c] && (!HINWEIS[c][2] || an.has(HINWEIS[c][2])))
      .map((c) => HINWEIS[c][en ? 1 : 0]);
  }
  // Beschriftung einer Form mit den echten Angaben der Entscheidung; fehlt der Wert: „– (nicht vorhanden)“ (M4).
  // Nur ohne jede Angabe (teile fehlt) das Muster mit „z. B.“.
  function formText(k, form, teile, nr, stil, en) {
    if (!teile) return (en ? "e.g. " : "z. B. ") + BAUSTEINE[k].formen[form];
    let w = ""; try { w = BAUSTEINE[k].wert(teile, nr, form, kontext(stil)); } catch (e) { w = ""; }
    return w || (en ? "– (not available)" : "– (nicht vorhanden)");
  }
  // Baut die Fundstelle. Ein Trenner „ (“ öffnet eine Klammer, die am Ende geschlossen wird.
  function formatiere(teile, stil, nr) {
    if (!gueltig(stil)) stil = VORLAGEN.de_standard.stil;
    teile = teile || {};
    const kx = kontext(stil);
    const artB = stil.bloecke.find((x) => x.k === "art");
    // OSCOLA: „, Opinion of AG Hogan“ / „, View of AG Kokott“ unmittelbar vor der Randnummer (sonst am Ende)
    let zusatz = artB.an && artB.form === "oscola" && MIT_GA(teile.art)
      ? `${teile.art === "sa" ? "Opinion" : "View"} of ${teile.ga ? "AG " + teile.ga : "the Advocate General"}` : "";
    let aus = "", offen = 0;
    const haenge = (w, vor) => { if (!aus) aus = w; else if (vor === " (") { aus += " (" + w; offen++; } else aus += vor + w; };
    for (const x of stil.bloecke) {
      if (!x.an) continue;
      const w = BAUSTEINE[x.k].wert(teile, nr, x.form, kx);
      if (!w) continue;
      if (x.k === "rn" && zusatz) { haenge(zusatz, ", "); zusatz = ""; }
      haenge(w, x.vor);
    }
    if (zusatz) haenge(zusatz, ", ");
    return aus + ")".repeat(offen);
  }
  const ANF = { de: ["„", "“"], en: ["“", "”"], fr: ["« ", " »"] };
  const INNEN = { de: ["‚", "‘"], en: ["‘", "’"], fr: ["‹ ", " ›"] };
  // Anführungszeichen im zitierten Text werden zu den inneren Zeichen der gewählten Art (GERING 7)
  function innen(text, anf) {
    const [a, z] = INNEN[anf] || INNEN.de;
    const paar = (_, x) => a + x + z;
    let s = text.replace(/„([^„“”"«»]*)[“”]/g, paar).replace(/“([^„“”"«»]*)”/g, paar)
      .replace(/«\s*([^«»]*?)\s*»/g, paar).replace(/"([^"]*)"/g, paar);
    // einzelne Zeichen ohne Gegenstück (Markierung mitten in einem Zitat)
    s = s.replace(/[„«]\s?/g, a).replace(/\s?»/g, z).replace(/(^|\s)["“”]/g, (_, v) => v + a).replace(/["“”]/g, z);
    return s;
  }
  function mitZitat(zitat, fundstelle, stil) {
    const [a, z] = ANF[stil?.anf] || ANF.de;
    const q = innen(String(zitat || "").replace(/\s+/g, " ").trim(), ANF[stil?.anf] ? stil.anf : "de");
    return stil?.zitat === "nach" ? `${fundstelle}: ${a}${q}${z}` : `${a}${q}${z} (${fundstelle})`;
  }
  globalThis.CPZitier = { BAUSTEINE, VORLAGEN, TRENNER, ANF, formatiere, mitZitat, gueltig, vorlageVon, kopie,
                          standard, wirksam, formText, hinweisTexte, kontext, verbinde, azText };
})();
