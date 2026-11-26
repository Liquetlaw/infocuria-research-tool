// Lesefunktionen für die Seiten der alten InfoCuria. Reine Funktionen ohne Wirkung auf die Seite, damit sie sich
// an beliebigen Dokumenten prüfen lassen (auch an per fetch geladenen). Benutzt von content.js.
// Grundsatz: Was sich nicht sicher lesen lässt, bleibt leer (mit Hinweis) – nichts wird geraten.
(() => {
  "use strict";
  const glatt = (s) => (s || "").replace(/[ \s]+/g, " ").trim();
  const strich = (s) => (s || "").replace(/[‐‑‒–]/g, "-");
  const MIT_GA = (a) => a === "sa" || a === "stellungnahme";

  // ---------- Datum ----------
  const MONATE = {
    de: ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"],
    en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
    fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  };
  const DATUM_SPRACHEN = ["DE", "EN", "FR"];
  function baueDatum(tag, wort, jahr) {
    const w = (wort || "").toLowerCase(), t = Number(tag);
    for (const liste of Object.values(MONATE)) {
      const i = liste.indexOf(w);
      if (i >= 0 && t >= 1 && t <= 31) return { tag: t, monat: i, jahr: Number(jahr) };
    }
    return null;
  }
  const gleich = (a, b) => a.tag === b.tag && a.monat === b.monat && a.jahr === b.jahr;
  const ohneMarke = (d) => (d ? { tag: d.tag, monat: d.monat, jahr: d.jahr } : null);
  // Streng: der Block besteht im Wesentlichen NUR aus dem Datum („8. Mai 2019(*)“, „vom 5. Dezember 2018(1)“,
  // „delivered on 5 December 2018 (1)“, „présentées le 5 décembre 2018 (1)“). Sonst kein Datum.
  // Jahreszahl nur 19xx/20xx; danach darf eine Fußnotenmarke stehen, auch ohne Klammer angeklebt (D9: „vom 16. Januar 20081(1)“
  // = 16. Januar 2008 + Fußnote 1). Ein so gelesenes Datum gilt als unsicher (unsicher: true) und wird von bestimmeTeile
  // gegen andere Fassungen geprüft.
  const STRENG = /^(?:vom|delivered on|présentées? le)?\s*(\d{1,2})(?:\.|er)?\s*(\p{L}+)\s+((?:19|20)\d{2})(\d{1,3}|\*+)?\s*(?:\(\s*[*\d]+\s*\)\s*)*$/iu;
  function strengesDatum(b) {
    const m = STRENG.exec(glatt(b)); if (!m) return null;
    const d = baueDatum(m[1], m[2], m[3]);
    if (d && m[4] && /\d/.test(m[4])) d.unsicher = true;
    return d;
  }
  // Datum am Ende des ersten <p> einer .decision der Verfahrensübersicht („… vom 8. Mai 2019“ / „… of 3 September 2008.“)
  const LISTE_DATUM = /(?:\bvom|\bof)\s+(\d{1,2})\.?\s+(\p{L}+)\s+(\d{4})\.?$/u;

  // ---------- Randnummern. Neues Format: <a name="point53">; altes Format (bis etwa 2004): <dt>53. </dt><dd>…</dd>;
  // drittes Format (D10, z. B. 69710): <p class="C01PointAltN">1.&nbsp;… ohne Anker – dann marke: null
  function randnummern(wurzel) {
    const liste = [];
    for (const a of wurzel.querySelectorAll('a[name^="point"]')) {
      const nr = parseInt(a.getAttribute("name").slice(5), 10);
      if (nr) liste.push({ nr, marke: a, block: a.closest("p") || a.parentElement });
    }
    if (!liste.length) {
      for (const dt of wurzel.querySelectorAll("dt")) {
        const m = /^\s*(\d+)\.?\s*$/.exec(dt.textContent);
        if (m && dt.nextElementSibling?.tagName === "DD") liste.push({ nr: Number(m[1]), marke: dt, block: dt.nextElementSibling });
      }
    }
    if (!liste.length) {
      // Nur <p> mit „Point“ in der Klasse, deren Text mit Zahl, optionalem Punkt und Leerraum beginnt; nur lückenlos
      // aufsteigend ab 1 – ein Kandidat, der nicht in die Folge passt, wird übergangen (C22Alineanumerote1 zählt nie)
      let erwartet = 1;
      for (const p of wurzel.querySelectorAll("p")) {
        if (!/Point/.test(p.className)) continue;
        const m = /^(\d+)\.?[\s\u00a0]/.exec(p.textContent);
        if (m && Number(m[1]) === erwartet) { liste.push({ nr: erwartet, marke: null, block: p }); erwartet++; }
      }
    }
    return liste;
  }

  // ---------- Kopf des Dokuments ----------
  // Titelzeilen (Versalien, wie in FIXTURES A/D7). Die Art aus dem Text verwendet bestimmeTeile nur bei DE/EN/FR;
  // die spanische SA-Zeile (A3) dient nur dazu, die Namenszeile darunter zu finden.
  const NB = "(?!\\p{L})";
  const TITEL = [
    ["sa", new RegExp(`^(?:SCHLUSSANTRÄGE DE[SR] GENERALANW|OPINION OF ADVOCATE GENERAL${NB}|CONCLUSIONS DE L[’'] ?AVOCATE? GÉNÉRAL|CONCLUSIONES DE L[AO] ABOGAD[AO] GENERAL${NB})`, "u")],
    ["stellungnahme", new RegExp(`^(?:STELLUNGNAHME DE[SR] GENERALANW|VIEW OF ADVOCATE GENERAL${NB}|PRISE DE POSITION DE L[’'] ?AVOCATE? GÉNÉRAL)`, "u")],
    ["gutachten", /^(?:GUTACHTEN|OPINION|AVIS) \d+\/\d+(?!\d)/u],
    ["beschluss", new RegExp(`^(?:BESCHLUSS|ORDER|ORDONNANCE)${NB}`, "u")],
    ["urteil", new RegExp(`^(?:URTEIL|JUDGMENT|ARRÊT)${NB}`, "u")],
  ];
  const titelArt = (b) => (TITEL.find(([, re]) => re.test(b || "")) || [])[0] || null;
  const ANREDE = /^(?:M\.|MME|MRS?\.?|MS\.?|SRA?\.?|SIG\.?(?:RA)?|HR\.?|D\.ª|DNA\.?|PANI?|K\.|G\.|П\.)\s+/iu;
  const PARTIKEL = new Set(["de", "la", "le", "du", "van", "von", "der", "den", "zu", "y"]);
  // Namenszeile: nur Buchstaben, Leerzeichen, Punkt, Apostroph, Bindestrich. versalien = nur Großbuchstaben zulassen.
  function istNamenszeile(b, versalien) {
    if (!b || b.length >= 60 || titelArt(b) || !/^[\p{L} .'’-]+$/u.test(b)) return false;
    return !versalien || b === b.toUpperCase();
  }
  function gaName(z) {
    const ohne = z.replace(ANREDE, "").trim();
    if (ohne !== ohne.toUpperCase()) return ohne;                  // gemischte Schreibung: wie gelesen („Juliane Kokott“, D7)
    return ohne.toLowerCase().split(" ").filter(Boolean)
      .map((w, i) => (i > 0 && PARTIKEL.has(w) ? w : w.replace(/(^|[-'’.])(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase()))).join(" ");
  }
  // Geschlecht: DE-Titel eindeutig. FR-Titel nur, wenn die Anrede dazu passt (der FR-Titel der Stellungnahme 2/13 lautet
  // „…DE L’AVOCAT GÉNÉRAL“, obwohl darunter „MME JULIANE KOKOTT“ steht – FIXTURES D7).
  function geschlecht(titel, namenszeile) {
    if (/GENERALANWÄLTIN/.test(titel)) return true;
    if (/GENERALANWALTS/.test(titel)) return false;
    const frau = /^MME\s/.test(namenszeile || ""), mann = /^M\.\s/.test(namenszeile || "");
    if (/AVOCATE GÉNÉRALE/.test(titel) && frau) return true;
    if (/AVOCAT GÉNÉRAL(?!E)/.test(titel) && mann) return false;
    return null;
  }
  // Kopfdaten eines Dokuments. inhalt = #document_content, umgebung = Text von #content OHNE #document_content (ECLI)
  function kopfdaten(inhalt, umgebung) {
    const bloecke = [...inhalt.querySelectorAll("p")].map((p) => glatt(p.textContent)).filter(Boolean).slice(0, 16);
    const ecli = (/ECLI:EU:[CTF]:\d{4}:\d+/.exec(umgebung || "") || [])[0] || null;
    const k = { bloecke, ecli, art: null, datum: null, ga: null, gaWeiblich: null, ohneTitel: false, az: null };
    const iT = bloecke.slice(0, 4).findIndex((b) => titelArt(b));
    if (iT >= 0) {
      k.art = titelArt(bloecke[iT]);
      if (MIT_GA(k.art)) {
        // Name direkt unter dem Titel, Datum direkt unter dem Namen
        if (istNamenszeile(bloecke[iT + 1], false)) {
          k.ga = gaName(bloecke[iT + 1]); k.datum = strengesDatum(bloecke[iT + 2]);
          // Zeile unmittelbar nach der Datumszeile: „Rechtssache X“ / „Case X“ / „Affaire X“ (A2, D7, D9)
          if (k.datum) k.az = azAusP(bloecke[iT + 3], true);
        }
        k.gaWeiblich = geschlecht(bloecke[iT], bloecke[iT + 1]);
      } else k.datum = strengesDatum(bloecke[iT + 1]) || strengesDatum(bloecke[iT + 2]);
    } else if (istNamenszeile(bloecke[0], true) && strengesDatum(bloecke[1])) {
      // altes Format ohne Titelzeile (A6: „JACOBS“ / „delivered on 21 March 2002 (1)“) – nur für Schlussanträge verwendet
      k.ohneTitel = true; k.ga = gaName(bloecke[0]); k.datum = strengesDatum(bloecke[1]);
    }
    return k;
  }

  // ---------- Verfahrensübersicht ----------
  // Bezeichnung der Zeile → Art. de: Urteil/Beschluss/Gutachten/Schlussanträge/Stellungnahme;
  // en: Judgment/Order/Opinions of the Court/Opinion/View (FIXTURES D2: das Gutachten heißt „Opinions of the Court“).
  function artAusListe(text) {
    const t = glatt(text).toLowerCase();
    if (/^(?:urteil|judgment)\b/.test(t)) return "urteil";
    if (/^(?:beschluss|order)\b/.test(t)) return "beschluss";
    if (/^(?:gutachten|opinions of the court)\b/.test(t)) return "gutachten";
    if (/^opinion of the court\b/.test(t)) return null;            // nicht beobachtet, mehrdeutig
    if (/^(?:schlussanträge|opinion)(?![\p{L}])/u.test(t)) return "sa";
    if (/^(?:stellungnahme|view)\b/.test(t)) return "stellungnahme";
    return null;
  }
  // Artwort im ersten <p> der .decision muss zur Zeile passen (K8)
  const ART_WORT = {
    urteil: /^(?:Urteil|Judgment)\b/,
    beschluss: /^(?:\S*[Bb]eschluss\b|(?:\S+\s+)?[Oo]rder\b)/,
    gutachten: /^(?:Gutachten|Opinion of the Court)\b/,
  };
  const AZ_P = /^(Verbundene Rechtssachen|Rechtssachen?|Joined [Cc]ases|Cases?|Affaire)\s+(.+?)\.?$/;
  // Mehrere Sachen: „Verbundene Rechtssachen/Joined cases“ und die Mehrzahl „Rechtssachen/Cases“ (N9)
  const VERBUNDEN = /^(?:Verbundene Rechtssachen|Joined [Cc]ases|Rechtssachen|Cases)$/;
  const AZ_EINZEL = /^(?:[CTF]-)?\d+[/-]\d+(?:\s+[A-Z]+(?:\([A-Z]\))?)*$/;
  const nrJahr = (s) => { const m = /(\d+)[/-](\d+)/.exec(s || ""); return m ? Number(m[1]) + "/" + m[2] : null; };
  const altNr = (x) => (/^[CTF]-/.test(x) ? x : x.replace(/^(\d+)-(\d+)/, "$1/$2"));
  // „Verbundene Rechtssachen C-402/05 P und C-415/05 P.“ → ["C-402/05 P", "C-415/05 P"]; „Rechtssache 6-64.“ → ["6/64"];
  // „Verbundene Rechtssachen C-622/16 P bis C-624/16 P“ / „Joined Cases … to …“ → { von, bis } (N2).
  // Beginnt die Zeile mit „Verbundene Rechtssachen/Joined cases/Rechtssachen/Cases“ und lässt sie sich nicht vollständig
  // lesen: "unlesbar".
  // kopf = true: Zeile aus dem Kopf eines Dokuments (dort auch „Affaire X“, A2); in der Übersicht gibt es „Affaire“ nicht.
  function azAusP(text, kopf = false) {
    const m = AZ_P.exec(strich(glatt(text)));
    if (!m || (m[1] === "Affaire" && !kopf)) return null;
    const verb = VERBUNDEN.test(m[1]);
    const bereich = /^(.+?)\s+(?:bis|to)\s+(.+)$/.exec(m[2]);
    if (bereich) {
      if (verb && AZ_EINZEL.test(bereich[1]) && AZ_EINZEL.test(bereich[2])) return { von: altNr(bereich[1]), bis: altNr(bereich[2]) };
      return verb ? "unlesbar" : null;
    }
    const liste = m[2].split(/\s*,\s*|\s+(?:und|and)\s+/).map((x) => x.trim());
    if (!liste.length || !liste.every((x) => AZ_EINZEL.test(x)) || (verb && liste.length < 2)) return verb ? "unlesbar" : null;
    return liste.map(altNr);
  }
  // Kommt das Aktenzeichen az (aus dem affaire_title) in der gelesenen Liste bzw. im Bereich vor?
  function enthaelt(gelesen, az) {
    const z = nrJahr(az);
    if (!z || !gelesen || typeof gelesen === "string") return false;
    if (Array.isArray(gelesen)) return gelesen.some((x) => nrJahr(x) === z);
    const [n, j] = z.split("/"), [vn, vj] = nrJahr(gelesen.von).split("/"), [bn, bj] = nrJahr(gelesen.bis).split("/");
    return j === vj && j === bj && Number(n) >= Number(vn) && Number(n) <= Number(bn);
  }
  function leseListe(d, ecli, basis, sprache) {
    const zeilen = [...d.querySelectorAll(".table_document_ligne")].map((tr) => {
      const zelle = tr.querySelector(".liste_table_cell_doc");
      return {
        art: glatt(zelle?.childNodes[0]?.textContent || zelle?.textContent).replace(/ECLI.*/, "").trim(),
        ecli: glatt(tr.querySelector(".outputEcliAff")?.textContent),
        docid: (/docid=(\d+)/.exec(tr.innerHTML) || [])[1] || null,
        // Sprachen mit HTML-Text: nur die document.jsf-Links im Tooltip von #docHtml (nicht PDF, nicht das Symbol)
        sprachen: [...new Set([...tr.querySelectorAll('[id="docHtml"] .tooltip a[href*="document.jsf"]')]
          .map((a) => (/doclang=(\w+)/.exec(a.getAttribute("href")) || [])[1]?.toUpperCase()).filter(Boolean))],
        tr,
      };
    });
    const zeile = zeilen.find((z) => z.ecli && z.ecli === ecli) || null;
    const aus = { sprache, zeile, zeilen: [], az: null, azEinzel: null, azMehrere: false, titelAz: null, gutachtenNr: null, name: null, stand: null, verwandt: [], datum: null, fiche: null,
                  leer: !d.querySelector(".affaire") };
    if (!zeile) return aus;                                         // nichts aus fremden Rechtssachen übernehmen (K2)
    const aff = zeile.tr.closest(".affaire");
    const dec = zeile.tr.closest("div.decision") || zeile.tr.closest(".decision");
    const titel = glatt(aff?.querySelector(".affaire_title")?.textContent);
    const m = /^(.+?)\s+[-–]\s+(.+)$/.exec(titel);
    aus.titelAz = m ? strich(m[1]) : null;
    aus.name = m ? m[2].replace(/\s*\/\s*/g, "/") : null;
    aus.gutachtenNr = (/^(?:Avis|Gutachten|Opinion)\s+(\d+\/\d+)$/.exec(aus.titelAz || "") || [])[1] || null;
    const ps = [...(dec?.querySelector(".decision_title")?.children || [])].filter((e) => e.tagName === "P").map((e) => glatt(e.textContent));
    if (!aus.gutachtenNr) {
      // Aktenzeichen aus dem Az-<p> der eigenen .decision, wenn das Aktenzeichen des affaire_title darin vorkommt (K3/K7/N2).
      // Gilt nur für Urteile/Beschlüsse; für Schlussanträge/Stellungnahmen siehe bestimmeTeile (N1).
      const azP = ps.slice(1).map((p) => azAusP(p)).find(Boolean) || null;
      const titelOk = aus.titelAz && AZ_EINZEL.test(aus.titelAz) && !/^C-\d+\/(?:[5-8]\d)(?!\d)/.test(aus.titelAz);
      if (azP === "unlesbar") aus.az = null;                    // Verbindung nicht vollständig lesbar: leer (+ Hinweis)
      else if (azP && enthaelt(azP, aus.titelAz)) aus.az = azP;
      // Rückfall affaire_title – aber nicht bei Altsachen (Jahr 52–89): dort steht „C-6/64“, der Gerichtshof zitiert „6/64“ (K7)
      else if (titelOk) aus.az = [aus.titelAz];
      // Genau EIN Aktenzeichen im Az-<p>, passend zum affaire_title: keine Verbindung im Spiel (für Schlussanträge, N1 Weg 2)
      aus.azEinzel = Array.isArray(azP) && azP.length === 1 && enthaelt(azP, aus.titelAz) ? azP : null;
      aus.azMehrere = !!azP && !(Array.isArray(azP) && azP.length === 1);   // Liste, Bereich oder unlesbar (N8)
    }
    // „Detaillierte Angaben“ (fiche) der eigenen .decision (D9)
    const fiche = dec?.querySelector('.decision_links a[href^="/juris/fiche.jsf?"]');
    aus.fiche = fiche ? fiche.getAttribute("href") : null;
    // Datum nur für Urteil/Beschluss/Gutachten, nur wenn die .decision genau eine Zeile mit ECLI hat, die nicht
    // Schlussanträge/Stellungnahme ist (= die eigene), und das Artwort im ersten <p> passt (K8, FIXTURES D3)
    const eigArt = artAusListe(zeile.art);
    if (dec && ART_WORT[eigArt]) {
      const mitEcli = zeilen.filter((z) => dec.contains(z.tr) && z.ecli && !MIT_GA(artAusListe(z.art)));
      if (mitEcli.length === 1 && mitEcli[0] === zeile && ART_WORT[eigArt].test(ps[0] || "")) {
        const md = LISTE_DATUM.exec(ps[0]);
        if (md) aus.datum = baueDatum(md[1], md[2], md[3]);
      }
    }
    if (aff) {
      aus.stand = glatt(aff.querySelector(".affaire_status")?.textContent).replace(/^\[|\]$/g, "") || null;
      aus.zeilen = zeilen.filter((z) => aff.contains(z.tr));
      aus.verwandt = [...aff.querySelectorAll("a")].filter((a) => a.querySelector(".pourvoi_title"))
        .map((a) => ({ text: glatt(a.textContent), href: new URL(a.getAttribute("href"), basis).href }));
    }
    return aus;
  }

  // Generalanwalt aus der fiche-Seite: Text der <p> zwischen <h3>Generalanwalt</h3> bzw. <h3>Advocate General</h3> und dem
  // nächsten <h3> (D9). Leer, „Information nicht verfügbar“ oder mehrdeutig → null. Kein Geschlecht daraus.
  // Verfahrenssprache(n) aus derselben Seite: <h3>Verfahrenssprache(n)</h3> bzw. <h3>Language(s) of the case</h3>, danach
  // die Einträge der Liste. Nur bekannte Sprachnamen werden zu Kürzeln; Unbekanntes wird ausgelassen, nicht geraten.
  const SPRACHNAMEN = {
    BG: ["bulgarisch", "bulgarian"], ES: ["spanisch", "spanish"], CS: ["tschechisch", "czech"], DA: ["dänisch", "danish"],
    DE: ["deutsch", "german"], ET: ["estnisch", "estonian"], EL: ["griechisch", "greek"], EN: ["englisch", "english"],
    FR: ["französisch", "french"], GA: ["irisch", "irish"], HR: ["kroatisch", "croatian"], IT: ["italienisch", "italian"],
    LV: ["lettisch", "latvian"], LT: ["litauisch", "lithuanian"], HU: ["ungarisch", "hungarian"], MT: ["maltesisch", "maltese"],
    NL: ["niederländisch", "dutch"], PL: ["polnisch", "polish"], PT: ["portugiesisch", "portuguese"], RO: ["rumänisch", "romanian"],
    SK: ["slowakisch", "slovak"], SL: ["slowenisch", "slovene", "slovenian"], FI: ["finnisch", "finnish"], SV: ["schwedisch", "swedish"],
  };
  const sprachKuerzel = (name) => Object.keys(SPRACHNAMEN).find((k) => SPRACHNAMEN[k].includes(glatt(name).toLowerCase())) || null;
  function ficheAbschnitt(d, re) {
    const h3 = [...d.querySelectorAll("h3")].find((h) => re.test(glatt(h.textContent)));
    if (!h3) return null;
    const p = [], li = [];
    for (let e = h3.nextElementSibling; e && e.tagName !== "H3"; e = e.nextElementSibling) {
      if (e.tagName === "P" && glatt(e.textContent)) p.push(glatt(e.textContent));
      for (const x of e.querySelectorAll?.("li") || []) if (glatt(x.textContent)) li.push(glatt(x.textContent));
      if (e.tagName === "UL" && !e.querySelector("li") && glatt(e.textContent)) li.push(glatt(e.textContent));
    }
    return { p, li };
  }
  function leseFiche(d) {
    const g = ficheAbschnitt(d, /^(?:Generalanwalt|Advocate General)$/);
    const w = g && g.p.length === 1 ? g.p[0] : null;
    const vs = ficheAbschnitt(d, /^(?:Verfahrenssprache\(n\)|Verfahrenssprachen?|Language\(s\) of the case|Languages? of the case)$/);
    const sprachen = [];
    for (const eintrag of vs ? [...vs.li, ...vs.p] : []) {
      for (const teil of eintrag.split(/\s*(?:,|;|\bund\b|\band\b)\s*/)) {
        const k = sprachKuerzel(teil);
        if (k && !sprachen.includes(k)) sprachen.push(k);
      }
    }
    return { ga: w && !/^Information (?:nicht verfügbar|not available)$/i.test(w) && istNamenszeile(w, false) ? w : null, verfahrenssprachen: sprachen };
  }

  // ---------- Prüfung einer geladenen Sprachfassung ----------
  // InfoCuria verwechselt bei gleichzeitigen Abrufen derselben Sitzung gelegentlich die Fassung (live beobachtet:
  // angefragt DE, geliefert FR oder ein ganz anderes Dokument). Die Abrufe laufen darum nacheinander (infocuria),
  // und jede geladene Fassung wird hier zusätzlich grob geprüft. Die Prüfung verwirft nur, sie ergänzt nichts.
  const KOPFWORT = {
    DE: /(?<![\p{L}])(?:URTEIL|BESCHLUSS|SCHLUSSANTRÄGE|GUTACHTEN|STELLUNGNAHME)(?![\p{L}])/iu,
    EN: /(?<![\p{L}])(?:JUDGMENT|ORDER|OPINION|VIEW)(?![\p{L}])/iu,
    FR: /(?<![\p{L}])(?:ARRÊT|ORDONNANCE|CONCLUSIONS|AVIS|PRISE DE POSITION)(?![\p{L}])/iu,
  };
  // Aktenzeichen-Nummern („680/22“) einer Rechtssache aus der Übersicht: affaire_title und die Zeilen der Entscheidungen
  function aktenNummern(aff) {
    if (!aff) return [];
    const text = [aff.querySelector(".affaire_title"), ...aff.querySelectorAll(".decision_title p")].map((e) => glatt(e?.textContent)).join(" ");
    const nr = new Set();
    for (const m of text.matchAll(/(?<![\d\/])(\d{1,4})\s*\/\s*(\d{2})(?![\d\/])/g)) nr.add(`${Number(m[1])}/${m[2]}`);
    return [...nr];
  }
  // Gehört der Text zur Rechtssache? Verworfen wird nur, wenn der Anfang ein Aktenzeichen mit Gerichtsbuchstaben nennt
  // („C-410/26“) und keine der Nummern aus der Übersicht. Ohne bekannte Nummern oder ohne Aktenzeichen im Text: nicht
  // prüfbar, nicht verwerfen.
  // Anfang des Textes, Textknoten durch Leerzeichen getrennt (sonst klebt „C-410/26“ an die Nummer des nächsten Absatzes)
  function anfangsText(c, max) {
    const w = c.ownerDocument.createTreeWalker(c, 4);
    let s = "";
    for (let n; s.length < max && (n = w.nextNode());) s += n.nodeValue + " ";
    return glatt(s).slice(0, max);
  }
  function nenntAktenzeichen(c, nummern) {
    if (!nummern?.length) return true;
    const anfang = anfangsText(c, 8000);
    const eigene = nummern.some((n) => { const [a, b] = n.split("/"); return new RegExp(`(?<![\\d/])0*${a}\\s*/\\s*${b}(?![\\d/])`).test(anfang); });
    if (eigene) return true;
    return !/(?<![\p{L}\d])[CTF]\s?[-‐‑‒–]\s?\d{1,4}\s*\/\s*\d{2}(?![\d\/])/u.test(anfang);
  }
  function passtFassung(c, lang) {
    const anfang = anfangsText(c, 300);
    const griechisch = /\p{Script=Greek}{3}/u.test(anfang), kyrillisch = /\p{Script=Cyrillic}{3}/u.test(anfang);
    if (lang === "EL") return griechisch;
    if (lang === "BG") return kyrillisch;
    if (griechisch || kyrillisch) return false;
    let erster = null, pos = Infinity;
    for (const [k, re] of Object.entries(KOPFWORT)) { const m = re.exec(anfang); if (m && m.index < pos) { pos = m.index; erster = k; } }
    if (!erster) return true;                        // keine Kopfzeile erkannt: nicht prüfbar, nicht verwerfen
    return erster === lang;
  }

  // ---------- Verweise: ECLI im Fließtext, danach optional die Randnummer ----------
  const ECLI_RE = /(?:ECLI:)?EU:([CTF]):(\d{4}):(\d+)/g;
  const RN_WORT = [
    "Rn\\.", "Randnrn?\\.", "Rdnrn?\\.", "Randnummern?", "Nrn?\\.",                // de
    "paragraphs?", "paras?\\.?", "points?",                                       // en, fr
    "punt[oi]", "apartados?", "n\\.os?", "n\\.º", "punten", "punt",                // it, es, pt, nl, mt
    "præmis(?:serne|sen)?", "punkt(?:erna|en|as|ai|o|s|u|i)?",                     // da, sv, et, lv, lt
    "pkt\\.?", "bod(?:y|u|ě|och)?", "točk[aei]", "kohd(?:at|assa|ista)", "kohta", "pont(?:ok|jai|ja|jában)?", // pl, cs/sk, sl/hr, fi, hu
    "т\\.", "σκέψ(?:η|εις)", "punct(?:ul|ele)",                                  // bg, el, ro
  ];
  // Nach „)“ nur Wörter, die nachweislich so stehen (A3: „), apartado 39“, „), punto 28“) – M5
  const RN_WORT_KLAMMER = ["apartados?", "punt[oi]", "n\\.os?", "n\\.º", "points?", "paragraphs?", "Rn\\.", "Randnrn?\\."];
  const BIS = "(?:\\s*(?:bis|to|à|al|a|-|–|til|tot|do|až|eta)\\s*(\\d+))?";
  const RN_RE = new RegExp(`^[\\s,;]*(?:${RN_WORT.join("|")})\\s*(\\d+)${BIS}`, "iu");
  const RN_RE_KLAMMER = new RegExp(`^\\)[\\s,;]*(?:${RN_WORT_KLAMMER.join("|")})\\s*(\\d+)${BIS}`, "iu");
  // Folgt auf die Nummer „des/der/of/du/de/del/della/do/da“, gehört sie zu etwas anderem („Nr. 3 des Anhangs“)
  const FREMD_DANACH = /^\s*(?:des|der|of|du|de|del|della|do|da)(?![\p{L}])/iu;
  function leseRn(danach) {
    const m = RN_RE.exec(danach) || RN_RE_KLAMMER.exec(danach);
    if (!m) return null;
    const rest = danach.slice(m[0].length);
    if (/^\d/.test(rest) || FREMD_DANACH.test(rest)) return null;
    return { von: Number(m[1]), bis: m[2] ? Number(m[2]) : null };
  }

  // ---------- Abrufe bei InfoCuria (gleiche Herkunft), mit Zwischenspeicher und Zeitgrenze ----------
  function infocuria(origin) {
    const cache = new Map();
    const kennung = new Map();                       // docid → Aktenzeichen-Nummern der Rechtssache (aus der Übersicht)
    // behalten(e): darf das Ergebnis im Zwischenspeicher bleiben? (Übersicht ohne jede .affaire: nein, N5a)
    const einmal = (k, f, behalten = () => true) => {
      if (!cache.has(k)) cache.set(k, f().then((e) => { if (!behalten(e)) cache.delete(k); return e; }, (e) => { cache.delete(k); throw e; }));
      return cache.get(k);
    };
    // Alle Abrufe nacheinander, auch über mehrere Tabs derselben Seite hinweg (Web Locks); ohne Web Locks eine Kette
    // in diesem Tab. Die Zeitgrenze läuft erst, wenn der Abruf an der Reihe ist.
    let kette = Promise.resolve();
    const nacheinander = (f) => {
      if (globalThis.navigator?.locks?.request) return navigator.locks.request("cp-infocuria", f);
      const p = kette.then(f, f);
      kette = p.catch(() => {});
      return p;
    };
    const hole = (url, grenze = globalThis.CPLesen.zeitgrenze) => nacheinander(() => holeJetzt(url, grenze));
    async function holeJetzt(url, grenze) {
      const ac = new AbortController();
      const abbruch = new Promise((_, nein) => ac.signal.addEventListener("abort", () => nein(new Error("Zeitüberschreitung"))));
      abbruch.catch(() => {});
      const uhr = setTimeout(() => ac.abort(), grenze);
      try {
        const r = await Promise.race([fetch(origin + url, { credentials: "include", signal: ac.signal }), abbruch]);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return new DOMParser().parseFromString(await Promise.race([r.text(), abbruch]), "text/html");
      } finally { clearTimeout(uhr); }
    }
    const dokUrl = (docid, lang, rn) => `/juris/document/document.jsf?text=&docid=${docid}&doclang=${lang}` + (rn ? `#point${rn}` : "");
    return {
      dokUrl,
      liste: (ecli, sprache) => einmal(`l|${ecli}|${sprache}`, async () => {
        const l = leseListe(await hole(`/juris/liste.jsf?critereEcli=${encodeURIComponent(ecli)}&language=${sprache}`), ecli, origin + "/juris/", sprache);
        // Aktenzeichen der Rechtssache merken: damit wird jedes später geladene Dokument dieser Rechtssache geprüft
        if (l.zeile) {
          const nr = aktenNummern(l.zeile.tr.closest(".affaire"));
          for (const z of l.zeilen.length ? l.zeilen : [l.zeile]) if (z.docid && nr.length) kennung.set(String(z.docid), nr);
        }
        return l;
      }, (l) => !l.leer),
      // fiche: kürzere Zeitgrenze (5 s, nie länger als die allgemeine); sie liefert nur die Schreibweise des Namens (N10)
      fiche: (href) => einmal(`f|${href}`, async () => leseFiche(await hole(href, Math.min(globalThis.CPLesen.ficheZeitgrenze, globalThis.CPLesen.zeitgrenze)))),
      // Liefert InfoCuria erkennbar eine andere Fassung, wird einmal neu geladen; danach gilt der Abruf als gescheitert.
      dokument: (docid, lang) => einmal(`d|${docid}|${lang}`, async () => {
        for (let versuch = 0; versuch < 2; versuch++) {
          const d = await hole(dokUrl(docid, lang));
          const c = d.querySelector("#document_content");
          if (!c || !glatt(c.textContent)) throw new Error("kein Text");
          if (passtFassung(c, String(lang).toUpperCase()) && nenntAktenzeichen(c, kennung.get(String(docid)))) return c;
        }
        throw new Error("falsche Fassung");
      }),
    };
  }

  // ---------- Alle Angaben für die Fundstelle ----------
  // Art: eigene Zeile der deutschen, sonst der englischen Übersicht, sonst Titelzeile eines DE/EN/FR-Textes.
  // Datum: Urteil/Beschluss/Gutachten aus der eigenen .decision (bei einer DE/EN/FR-Seite gegen deren Kopf geprüft);
  // Schlussanträge/Stellungnahmen nur aus dem Kopf einer DE/EN/FR-Fassung. Aktenzeichen und Bezeichnung nur aus der
  // eigenen Rechtssache; bei Schlussanträgen/Stellungnahmen das Aktenzeichen aus dem Kopf (N1).
  // hinweise: Codes der Bausteine, die fehlen. speichern: nur dann darf das Ergebnis zwischengespeichert werden
  // (deutsche Übersicht mit eigener Zeile und kein fehlgeschlagener Abruf, M1/N5).
  const istAbruffehler = (e) => !(e && e.message === "kein Text");
  async function bestimmeTeile(kopf, docid, doclang, ic) {
    const ecli = kopf.ecli;
    const t = { gericht: ecli ? ecli.split(":")[2] : null, art: null, datum: null, ga: null, gaWeiblich: null, name: {},
                az: null, gutachtenNr: null, ecli, hinweise: [], speichern: false };
    const h = (c) => { if (!t.hinweise.includes(c)) t.hinweise.push(c); };
    let fehlgeschlagen = false;                                 // Buchführung: ist ein Abruf gescheitert? (N5b)
    const L = {};
    if (ecli) for (const sp of ["de", "en"]) { try { L[sp] = await ic.liste(ecli, sp); } catch (e) { fehlgeschlagen = true; } }
    const de = L.de?.zeile ? L.de : null, en = L.en?.zeile ? L.en : null;
    if (!ecli) h("ecli");
    else if (!L.de && !L.en) h("uebersicht");
    else if (!de && !en) h("zeile");
    const zeile = (de || en)?.zeile || null;

    // Andere Sprachfassungen desselben Dokuments (nur HTML-Sprachen laut Übersicht, falls bekannt)
    const koepfe = new Map();
    async function kopfIn(sp, laden = true) {
      if (!sp) return null;
      if (sp === doclang) return kopf;
      if (koepfe.has(sp)) return koepfe.get(sp);
      if (!laden || !docid || (zeile && !zeile.sprachen.includes(sp))) return null;
      let k = null;
      try { k = kopfdaten(await ic.dokument(docid, sp), ""); } catch (e) { if (istAbruffehler(e)) fehlgeschlagen = true; }
      koepfe.set(sp, k);
      return k;
    }
    const eindeutig = (l) => l.filter((x, i, a) => x && a.indexOf(x) === i);
    async function erster(sprachen, f, laden = true) {
      for (const sp of eindeutig(sprachen)) { const k = await kopfIn(sp, laden); const w = k ? f(k) : null; if (w !== null && w !== undefined) return w; }
      return null;
    }
    const DEF = [doclang, "FR", "DE", "EN"].filter((x) => DATUM_SPRACHEN.includes(x));

    // Art
    const artDe = de ? artAusListe(de.zeile.art) : null, artEn = en ? artAusListe(en.zeile.art) : null;
    const widerspruch = artDe && artEn && artDe !== artEn;
    let ausListe = false;
    if (!widerspruch && (artDe || artEn)) { t.art = artDe || artEn; ausListe = true; }
    else if (!widerspruch) t.art = await erster(DEF, (k) => (k.ohneTitel ? null : k.art));
    if (!t.art) h("art");
    const sa = MIT_GA(t.art);
    // fiche gleich hier starten, parallel zu den Abrufen der Sprachfassungen (N10); ihr Scheitern zählt nicht als
    // Abruffehler, weil sie nur die Schreibweise des Namens liefert
    const ficheHref = sa && ausListe ? de?.fiche || en?.fiche : null;
    const ficheGaP = ficheHref && ic.fiche ? ic.fiche(ficheHref).then((f) => f.ga, () => null) : Promise.resolve(null);

    // Datum (für SA/Stellungnahme zuerst, weil dabei die Köpfe geladen werden, die auch Aktenzeichen und Namen liefern)
    if (t.art) {
      const ausText = (k) => (k.datum && (!k.ohneTitel || sa) ? k.datum : null);
      if (sa) {
        // ein unsicher gelesenes Datum (angeklebte Fußnotenziffer) nur, wenn keine andere Fassung ein sicheres liefert
        let unsicher = null;
        t.datum = await erster(DEF, (k) => { const d = ausText(k); if (d?.unsicher) { unsicher ||= d; return null; } return d; });
        t.datum = ohneMarke(t.datum || unsicher);
      } else {
        const dDe = de?.datum || null, dEn = en?.datum || null;
        const ueb = dDe || dEn, streit = dDe && dEn && !gleich(dDe, dEn);
        const text = (DATUM_SPRACHEN.includes(doclang) ? ausText(kopf) : null) || (ueb ? null : await erster(DEF, ausText));
        t.datum = ohneMarke(streit || (ueb && text && !gleich(ueb, text)) ? null : ueb || text);
      }
      if (!t.datum) h("datum");
    }

    // Aktenzeichen und Bezeichnung (M3: beim Gutachtenverfahren keine Bezeichnung – affaire_title ist nicht übersetzt)
    if (de || en) {
      const q = de || en;
      t.gutachtenNr = q.gutachtenNr;
      if (!t.gutachtenNr && sa) {
        // N1: Schlussanträge/Stellungnahmen gehören oft nur zu einer der später verbundenen Sachen (D1/D9: 2008:11 nur
        // C-402/05 P). Weg 1: Aktenzeichen-Zeile im Kopf (eigene oder schon geladene Fassung), wenn das Aktenzeichen des
        // affaire_title darin vorkommt; Weg 2: Az-<p> der .decision mit genau EINEM passenden Aktenzeichen;
        // Weg 1 mit weiteren DE/EN/FR-Fassungen; sonst leer.
        const ausKopf = (k) => (k.az && k.az !== "unlesbar" && enthaelt(k.az, q.titelAz) ? k.az : null);
        t.az = await erster(DEF, ausKopf, false) || de?.azEinzel || en?.azEinzel || await erster(DEF, ausKopf) || null;
      } else if (!t.gutachtenNr) t.az = de?.az || en?.az || null;
      // Bezeichnung: bei Schlussanträgen/Stellungnahmen nur, wenn der affaire_title genau diese eine Sache bezeichnet –
      // ermitteltes Aktenzeichen ist genau eines, gleich dem des affaire_title, und das Az-<p> nennt nicht mehrere (N8)
      const eineSache = !sa || (Array.isArray(t.az) && t.az.length === 1 && enthaelt(t.az, q.titelAz) && !de?.azMehrere && !en?.azMehrere);
      if (!t.gutachtenNr && eineSache) { if (de?.name) t.name.de = de.name; if (en?.name) t.name.en = en.name; }
    }
    if (!t.az && !t.gutachtenNr) h("az");
    if (!t.gutachtenNr && !t.name.de && !t.name.en) h("name");

    // Generalanwalt/Generalanwältin (nur wenn die Art aus der Übersicht stammt, M6). Schreibweise bevorzugt aus der fiche
    // der eigenen .decision (D9); ein aus dem Kopf gelesener Name hat Vorrang, wenn er der fiche widerspricht.
    // Geschlecht nur aus DE/FR-Titeln; unbekannt bleibt null (neutrale Form, K9).
    if (sa) {
      if (ausListe) {
        const ficheGa = await ficheGaP;
        const reihe = ["EN", doclang, "DE", "FR"];
        if (ficheGa) {
          const kopfGa = await erster(reihe, (k) => k.ga, false);    // nur schon vorhandene Köpfe, nichts nachladen
          const f = ficheGa.toLowerCase(), g = (kopfGa || "").toLowerCase();
          t.ga = !kopfGa || g === f || g.endsWith(" " + f) ? ficheGa : kopfGa;
        } else t.ga = await erster(reihe, (k) => k.ga);
        t.gaWeiblich = await erster([doclang, "DE", "FR"].filter((x) => x === "DE" || x === "FR"), (k) => k.gaWeiblich);
      }
      if (!t.ga) h("ga");
    }
    t.speichern = !!de && !fehlgeschlagen;
    return t;
  }

  globalThis.CPLesen = { infocuria, bestimmeTeile, glatt, strich, strengesDatum, DATUM_SPRACHEN, randnummern, kopfdaten,
                         artAusListe, azAusP, leseListe, leseFiche, passtFassung, nenntAktenzeichen, aktenNummern, sprachKuerzel, leseRn, ECLI_RE, RN_RE, RN_RE_KLAMMER, zeitgrenze: 15000, ficheZeitgrenze: 5000 };
})();
