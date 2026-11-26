// Research tool for InfoCuria (unofficial). Läuft nur auf den Dokumentseiten der alten InfoCuria
// (…/juris/document/document.jsf). Liest ausschließlich, was die Seite und InfoCuria selbst liefern; nichts wird
// an Dritte gesendet. Drei Funktionen: Fundstelle kopieren, Verweise mit Vorschau, Seitenleiste mit Gliederung.
(() => {
  "use strict";
  if (globalThis.__cpGestartet || document.querySelector("#cp-meldung")) return;
  globalThis.__cpGestartet = true;
  const L = globalThis.CPLesen;
  const { glatt } = L;

  // ---------- Grundlagen ----------
  const param = new URLSearchParams(location.search);
  // Sprache der Oberfläche: Einstellung im Seitenbereich („ui“), sonst die Sprache der InfoCuria-Seite
  const SEITE_EN = (param.get("language") || document.documentElement.lang || "de").toLowerCase().startsWith("en");
  let UI_EN = SEITE_EN;
  const setzeUi = (ui) => { UI_EN = ui ? ui === "en" : SEITE_EN; };
  const T = (de, en) => (UI_EN ? en : de);
  const nachrichten = globalThis.chrome?.runtime?.onMessage;
  const inhalt = document.querySelector("#document_content");

  // Dokument in dieser Sprache nicht verfügbar (#document_content leer, FIXTURES A): nichts einrichten,
  // dem Seitenbereich nur diesen Zustand melden (K1).
  if (!inhalt || !glatt(inhalt.textContent)) {
    if (nachrichten) {
      nachrichten.addListener((m, absender, antwort) => {
        if (m?.an !== "cp-seite" || m.typ !== "daten") return;
        if ("ui" in m) setzeUi(m.ui);
        antwort({ keinText: true, en: UI_EN, url: location.href });
      });
    }
    if (!globalThis.chrome?.runtime?.id) globalThis.__cpTest = { keinText: true };
    return;
  }

  // Sprache des Dokuments: Auswahlfeld der Seite, sonst URL, sonst unbekannt (nicht „DE“ annehmen)
  const DOCLANG = (document.querySelector(".document_language option[selected]")?.value || param.get("doclang") || "").toUpperCase() || null;
  const speicher = {
    async lies(k, standard) {
      try { if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get(k))[k] ?? standard; } catch (e) {}
      try { const v = localStorage.getItem("cp-" + k); return v === null ? standard : JSON.parse(v); } catch (e) { return standard; }
    },
  };
  const el = (tag, attrs = {}, ...kinder) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const k of kinder) if (k) e.append(k);
    return e;
  };

  // ---------- Randnummern und Kopfdaten der Seite (Lesefunktionen in lesen.js) ----------
  const RN = L.randnummern(inhalt);
  // Drittes Format ohne Anker (D10): die führende Nummer im ersten Textknoten des Absatzes wird zur Marke (Textknoten
  // geteilt, kein innerHTML). Beginnt der Absatz nicht mit genau dieser Nummer, bleibt er ohne Doppelklick-Marke.
  for (const r of RN) {
    if (r.marke) continue;
    const tn = r.block.firstChild, m = tn?.nodeType === 3 ? new RegExp(`^${r.nr}\\.?(?!\\d)`).exec(tn.nodeValue) : null;
    if (!m) continue;
    tn.splitText(m[0].length);
    const marke = el("span", { class: "cp-rn", text: m[0] });
    tn.replaceWith(marke);
    r.marke = marke;
  }
  const MARKEN = RN.filter((r) => r.marke);
  const rnVonBlock = new Map(RN.flatMap((r) => (r.marke ? [[r.block, r.nr], [r.marke, r.nr]] : [[r.block, r.nr]])));
  // ECLI der Seite nur aus #content außerhalb des Dokumenttextes (M7)
  function rahmenText() {
    const c = document.querySelector("#content");
    if (!c) return "";
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    let s = "";
    for (let n; (n = w.nextNode());) if (!inhalt.contains(n)) s += n.nodeValue + " ";
    return s;
  }
  const KOPF = L.kopfdaten(inhalt, rahmenText());
  const ECLI = KOPF.ecli;

  // ---------- InfoCuria-Abrufe und Angaben zur Fundstelle (lesen.js) ----------
  const IC = L.infocuria(location.origin);
  const { liste, dokument, dokUrl } = IC;
  const DOCID = param.get("docid");
  let STIL = null;                                   // gespeicherter Stil; wirksam wird er über CPZitier.wirksam
  const stil = () => CPZitier.wirksam(STIL, UI_EN);
  // Zwischenspeicher nur, wenn die deutsche Übersicht geladen und die eigene Zeile gefunden wurde (M1)
  let teileCache = null, teileFertig = false;
  // InfoCuria liefert gelegentlich ein anderes Dokument als angefragt (live beobachtet, auch beim Öffnen einer Seite).
  // Passt der Text der Seite erkennbar nicht zu ihrer Sprache oder zum Aktenzeichen aus der Übersicht, gibt es einen
  // Hinweis („seite“) und nichts wird zwischengespeichert; nach dem Neuladen wird neu geprüft.
  async function pruefeSeite(t) {
    let l = null;
    for (const sp of ["de", "en"]) { try { l = await liste(ECLI, sp); } catch (e) { l = null; } if (l?.zeile) break; }
    const nr = l?.zeile ? L.aktenNummern(l.zeile.tr.closest(".affaire")) : [];
    if (L.nenntAktenzeichen(inhalt, nr) && (!DOCLANG || L.passtFassung(inhalt, DOCLANG))) return t;
    return { ...t, hinweise: [...(t.hinweise || []), "seite"], speichern: false };
  }
  const teile = () => (teileCache ||= L.bestimmeTeile(KOPF, DOCID, DOCLANG, IC).then((t) => (ECLI ? pruefeSeite(t) : t)).then(
    (t) => { if (t.speichern) teileFertig = true; else teileCache = null; return t; },
    (e) => { teileCache = null; throw e; }));
  const fundstelle = async (nr) => CPZitier.formatiere(await teile(), stil(), nr);
  async function kopiere(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); return ok;
  }
  const meldung = el("div", { id: "cp-meldung", role: "status", "aria-live": "polite" });
  let meldungZeit;
  function melde(text, dauer = 3500) { meldung.textContent = text; meldung.classList.add("an"); clearTimeout(meldungZeit); meldungZeit = setTimeout(() => meldung.classList.remove("an"), dauer); }
  // nr: Zahl, Bereich { von, bis } oder null; extra: zusätzliche Hinweis-Codes (z. B. "rn")
  async function kopiereFundstelle(nr, zitat, extra = []) {
    try {
      if (!teileFertig) melde(T("Fundstelle wird ermittelt …", "Determining citation …"), 20000);
      const t = await teile(), st = stil();
      const f = CPZitier.formatiere(t, st, nr);
      const text = zitat ? CPZitier.mitZitat(zitat, f, st) : f;
      const h = CPZitier.hinweisTexte(t, st, UI_EN, extra);
      const ok = await kopiere(text);
      melde((ok ? T("Kopiert: ", "Copied: ") : T("Kopieren nicht möglich: ", "Could not copy: ")) + text
        + (h.length ? "\n" + T("Unvollständig: ", "Incomplete: ") + h.join("; ") : ""), h.length ? 8000 : 3500);
      return text;
    } catch (e) {
      melde(T("Die Fundstelle ließ sich nicht ermitteln.", "The citation could not be determined."));
      return null;
    }
  }
  for (const r of RN) {
    r.block.id = r.block.id || `cp-point${r.nr}`;
    if (!r.marke) continue;
    r.marke.classList.add("cp-rn");
    r.marke.addEventListener("dblclick", (e) => { e.preventDefault(); getSelection()?.removeAllRanges(); kopiereFundstelle(r.nr); });
  }

  // ---------- Markierten Text mit Fundstelle kopieren (K6, M8) ----------
  const auswahlKnopf = el("button", { id: "cp-auswahl", type: "button" });
  let auswahl = null;
  function beschrifte() {
    for (const r of MARKEN) r.marke.title = T("Doppelklick: Fundstelle kopieren", "Double-click: copy citation");
    auswahlKnopf.textContent = T("Mit Fundstelle kopieren", "Copy with citation");
  }
  function rnZuKnoten(k) { for (let n = k; n && n !== inhalt; n = n.parentNode) if (rnVonBlock.has(n)) return rnVonBlock.get(n); return null; }
  // Textknoten, aus denen die Markierung tatsächlich Zeichen enthält (Start am Knotenende zählt nicht)
  function markierteTexte(r) {
    const wurzel = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT), liste = [];
    for (let n; (n = w.nextNode());) {
      if (!r.intersectsNode(n)) continue;
      const a = n === r.startContainer ? r.startOffset : 0, b = n === r.endContainer ? r.endOffset : n.length;
      if (/\S/.test(n.nodeValue.slice(a, b))) liste.push(n);
    }
    return liste;
  }
  // Zitattext ohne Randnummer-Marken (<a name="point…"> bzw. <dt>), Absätze durch Leerzeichen getrennt
  function zitatText(r) {
    const frag = r.cloneContents();
    for (const m of frag.querySelectorAll(".cp-rn")) m.remove();
    for (const b of frag.querySelectorAll("p, dd, dt, li, div, td, br")) b.after(" ");
    return glatt(frag.textContent);
  }
  function pruefeAuswahl() {
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount || !inhalt.contains(s.anchorNode) || !inhalt.contains(s.focusNode)) { auswahlKnopf.classList.remove("an"); auswahl = null; return; }
    const r = s.getRangeAt(0);
    const text = zitatText(r);
    if (text.length < 3) { auswahlKnopf.classList.remove("an"); auswahl = null; return; }
    const knoten = markierteTexte(r);
    const von = knoten.length ? rnZuKnoten(knoten[0]) : null, bis = knoten.length ? rnZuKnoten(knoten[knoten.length - 1]) : null;
    const nr = !von || !bis ? null : von === bis ? von : { von: Math.min(von, bis), bis: Math.max(von, bis) };
    auswahl = { text, nr };
    auswahlKnopf.dataset.rn = !nr ? "" : typeof nr === "object" ? `${nr.von}-${nr.bis}` : String(nr);
    const b = r.getBoundingClientRect();
    auswahlKnopf.style.top = `${window.scrollY + b.bottom + 6}px`;
    auswahlKnopf.style.left = `${window.scrollX + Math.max(8, b.left)}px`;
    auswahlKnopf.classList.add("an");
  }
  document.addEventListener("mouseup", (e) => { if (e.target !== auswahlKnopf) setTimeout(pruefeAuswahl, 0); });
  let auswahlZeit;                                   // auch bei Auswahl mit der Tastatur (Umschalt+Pfeile)
  document.addEventListener("selectionchange", () => { clearTimeout(auswahlZeit); auswahlZeit = setTimeout(pruefeAuswahl, 250); });
  auswahlKnopf.addEventListener("click", () => {
    if (auswahl) kopiereFundstelle(auswahl.nr, auswahl.text, auswahl.nr ? [] : ["rn"]);
    auswahlKnopf.classList.remove("an");
  });

  // ---------- Verweise auf andere Entscheidungen (über die ECLI) ----------
  const { ECLI_RE } = L;
  // Text nach der ECLI: Rest des Knotens und die folgenden Textknoten desselben Absatzes (GERING 3)
  function folgeText(n, ab, max = 60) {
    let s = n.nodeValue.slice(ab);
    const block = n.parentElement.closest("p, dd, li, td") || inhalt;
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    w.currentNode = n;
    for (let k; s.length < max && (k = w.nextNode());) s += k.nodeValue;
    return s.slice(0, max);
  }
  function verlinke(wurzel) {
    const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest("a, script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const knoten = []; for (let n; (n = w.nextNode());) if (/EU:[CTF]:\d{4}:\d+/.test(n.nodeValue)) knoten.push(n);
    for (const n of knoten) {
      const text = n.nodeValue, frag = document.createDocumentFragment();
      let pos = 0, m; ECLI_RE.lastIndex = 0;
      while ((m = ECLI_RE.exec(text))) {
        const ecli = `ECLI:EU:${m[1]}:${m[2]}:${m[3]}`;
        if (ecli === ECLI) continue;
        const rn = L.leseRn(folgeText(n, m.index + m[0].length));
        frag.append(text.slice(pos, m.index));
        const a = el("a", { class: "cp-verweis", href: `/juris/liste.jsf?critereEcli=${encodeURIComponent(ecli)}&language=${UI_EN ? "en" : "de"}`, target: "_blank", rel: "noopener", "data-ecli": ecli, text: m[0] });
        if (rn) { a.dataset.rn = rn.von; if (rn.bis && rn.bis - rn.von <= 2 && rn.bis > rn.von) a.dataset.bis = rn.bis; }
        frag.append(a); pos = m.index + m[0].length;
      }
      if (pos) { frag.append(text.slice(pos)); n.replaceWith(frag); }
    }
  }
  verlinke(inhalt);

  const fenster = el("div", { id: "cp-fenster", role: "dialog", "aria-label": T("Zitierte Stelle", "Cited passage") });
  let fensterFuer = null, fensterZeit;
  function schliesseFenster() { fenster.classList.remove("an"); fensterFuer = null; }
  async function ladeStelle(ecli, von, bis) {
    const l = await liste(ecli, UI_EN ? "en" : "de");
    if (!l.zeile?.docid) return { l, fehler: T("InfoCuria führt zu dieser ECLI kein Dokument.", "InfoCuria has no document for this ECLI.") };
    const verf = l.zeile.sprachen;                   // nur Sprachen mit HTML-Text
    if (!verf.length) return { l, fehler: T("InfoCuria bietet dieses Dokument nicht als Text an.", "InfoCuria does not offer this document as text.") };
    // Reihenfolge: Sprache des geöffneten Dokuments, dann Englisch, dann die Verfahrenssprache(n) laut „Detaillierte
    // Angaben“ des zitierten Verfahrens. Erst wenn keine davon geht, eine andere Fassung (mit Angabe der Sprache).
    let ersatz = null;                               // Fassung ohne Treffer; weitere Sprachen versuchen (GERING 4)
    const versucht = new Set();
    async function versuche(lang, grund) {
      if (!lang || versucht.has(lang) || !verf.includes(lang)) return null;
      versucht.add(lang);
      let c;
      try { c = await dokument(l.zeile.docid, lang); } catch (e) { return null; }
      if (!von) return { l, lang, grund, absaetze: [] };
      const alle = L.randnummern(c);
      const treffer = alle.filter((r) => r.nr >= von && r.nr <= (bis || von));
      const s = { l, lang, grund, absaetze: treffer.map((r) => ({ nr: r.nr, text: glatt(r.block.textContent).replace(new RegExp(`^${r.nr}\\.?\\s*`), "") })), ohneNummern: !alle.length };
      if (treffer.length) return s;
      ersatz ||= s;
      return null;
    }
    for (const lang of [DOCLANG, "EN"]) { const s = await versuche(lang, null); if (s) return s; }
    let vs = [];
    if (l.fiche) { try { vs = (await IC.fiche(l.fiche)).verfahrenssprachen || []; } catch (e) { vs = []; } }
    for (const lang of vs) { const s = await versuche(lang, "vs"); if (s) return s; }
    for (const lang of ["DE", "FR"]) { const s = await versuche(lang, null); if (s) return s; }
    if (!ersatz) { const s = await versuche(verf[0], null); if (s) return s; }
    return ersatz || { l, fehler: T("Der Text ließ sich nicht laden.", "The text could not be loaded.") };
  }
  async function zeigeFenster(a) {
    fensterFuer = a;
    const ecli = a.dataset.ecli, von = Number(a.dataset.rn) || null, bis = Number(a.dataset.bis) || null;
    const r = a.getBoundingClientRect();
    fenster.style.top = `${window.scrollY + r.bottom + 6}px`;
    fenster.style.left = `${window.scrollX + Math.max(8, Math.min(r.left, window.innerWidth - 478))}px`;
    fenster.replaceChildren(el("p", { class: "cp-leise", text: T("Lädt …", "Loading …") }));
    fenster.classList.add("an");
    let s;
    try { s = await ladeStelle(ecli, von, bis); } catch (e) { s = { fehler: T("InfoCuria ist nicht erreichbar.", "InfoCuria cannot be reached.") }; }
    if (fensterFuer !== a) return;
    // Bezeichnung in der Sprache der gezeigten Fassung, wenn deutsch oder englisch; sonst in der Sprache der Oberfläche
    const tsp = s.lang === "DE" ? "de" : s.lang === "EN" ? "en" : UI_EN ? "en" : "de";
    if (s.l && s.l.sprache !== tsp) {
      try { const l2 = await liste(ecli, tsp); if (l2.zeile?.docid === s.l.zeile?.docid) s.l = l2; } catch (e) {}
      if (fensterFuer !== a) return;
    }
    const teile = [];
    // Titel des Verfahrens; bei Schlussanträgen/Stellungnahmen nur der affaire_title (das Az-<p> gilt dort nicht, N1)
    const zielSa = ["sa", "stellungnahme"].includes(L.artAusListe(s.l?.zeile?.art));
    const az = s.l?.zeile ? (!zielSa && s.l.az ? CPZitier.azText(s.l.az, s.l.sprache === "en" ? "en" : "de") : s.l.titelAz) : null;
    if (az) teile.push(el("p", { class: "cp-titel", text: [az, s.l.name].filter(Boolean).join(" – ") }));
    const fassung = s.lang && s.lang !== DOCLANG
      ? ` · ${T("Fassung", "version")} ${s.lang}` + (s.grund === "vs" ? ` (${T("Verfahrenssprache", "language of the case")})` : "") : "";
    teile.push(el("p", { class: "cp-leise", text: ecli + fassung }));
    if (s.fehler) teile.push(el("p", { text: s.fehler }));
    else if (von && !s.absaetze.length) teile.push(el("p", { text: s.ohneNummern ? T("Die Randnummern dieses Textes sind nicht maschinell lesbar.", "The paragraph numbers of this text cannot be read.")
      : zielSa ? T(`Nummer ${von} wurde nicht gefunden.`, `Point ${von} was not found.`) : T(`Randnummer ${von} wurde nicht gefunden.`, `Paragraph ${von} was not found.`) }));
    for (const ab of s.absaetze || []) teile.push(el("p", { class: "cp-absatz" }, el("b", { text: ab.nr + " " }), ab.text.length > 1500 ? ab.text.slice(0, 1500) + " …" : ab.text));
    const links = el("p", { class: "cp-links" });
    if (s.l?.zeile?.docid && s.lang) links.append(el("a", { href: dokUrl(s.l.zeile.docid, s.lang, s.absaetze?.length ? von : null), target: "_blank", rel: "noopener", text: T("Entscheidung öffnen", "Open decision") }), " · ");
    links.append(el("a", { href: a.href, target: "_blank", rel: "noopener", text: T("Verfahren bei InfoCuria", "Case on InfoCuria") }));
    teile.push(links);
    fenster.replaceChildren(...teile);
  }
  inhalt.addEventListener("click", (e) => { const a = e.target.closest?.("a.cp-verweis"); if (!a) return; e.preventDefault(); if (fensterFuer === a) schliesseFenster(); else zeigeFenster(a); });
  inhalt.addEventListener("mouseover", (e) => { const a = e.target.closest?.("a.cp-verweis"); if (!a || fensterFuer === a) return; clearTimeout(fensterZeit); fensterZeit = setTimeout(() => zeigeFenster(a), 350); });
  inhalt.addEventListener("mouseout", (e) => { if (e.target.closest?.("a.cp-verweis")) clearTimeout(fensterZeit); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { schliesseFenster(); auswahlKnopf.classList.remove("an"); } });
  document.addEventListener("mousedown", (e) => { if (fensterFuer && !fenster.contains(e.target) && !e.target.closest?.("a.cp-verweis")) schliesseFenster(); });
  // Beim Blättern (InfoCuria lässt je nach Fenster das <body> oder das Fenster rollen) schließt das Vorschaufenster,
  // und der Knopf für die Markierung rückt an seine Stelle nach. Rollen im Vorschaufenster selbst zählt nicht.
  document.addEventListener("scroll", (e) => {
    if (e.target === fenster || (e.target.nodeType === 1 && fenster.contains(e.target))) return;
    if (fensterFuer) schliesseFenster();
    if (auswahlKnopf.classList.contains("an")) pruefeAuswahl();
  }, true);

  // ---------- Daten für die Seitenleiste (Chrome-Seitenbereich, panel.html) ----------
  // Die Leiste ist ein eigener Seitenbereich des Browsers: Chrome schiebt die Seite zur Seite, nichts überlappt.
  // Hier liegen nur die Angaben bereit; panel.js fragt sie über chrome.runtime-Nachrichten ab.
  function gliederungDaten() {
    const titel = [...inhalt.querySelectorAll('p[class*="Titre"], p[class*="Dispositif"]')].filter((p) => glatt(p.textContent));
    const eintraege = [];
    let tenor = false;
    titel.forEach((p, i) => {
      p.id = p.id || `cp-titel${i}`;
      if (/Dispositif/.test(p.className)) { if (!tenor) eintraege.push({ id: p.id, ebene: 1, text: T("Tenor", "Operative part") }); tenor = true; return; }
      eintraege.push({ id: p.id, ebene: Math.min(5, Number((/(\d)$/.exec(p.className) || [])[1]) || 1), text: glatt(p.textContent) });
    });
    return eintraege;
  }
  async function daten() {
    let l = null;
    if (ECLI) { try { l = await liste(ECLI, UI_EN ? "en" : "de"); } catch (e) {} }
    const links = [];
    if (l?.zeile) {
      for (const v of l.verwandt) links.push({ text: v.text, href: v.href });
      for (const z of l.zeilen) {
        if (!z.docid || !z.ecli || z.ecli === ECLI || !z.sprachen.length) continue;
        const sp = [DOCLANG, "EN", "DE", "FR"].find((x) => x && z.sprachen.includes(x)) || z.sprachen[0];
        links.push({ text: `${z.art} (${z.ecli})`, href: location.origin + dokUrl(z.docid, sp) });
      }
    }
    if (ECLI) {
      links.push({ text: T("Wer zitiert diese Entscheidung? (Textsuche nach der ECLI)", "Who cites this decision? (text search for the ECLI)"), neu: true,
                   href: `${location.origin}/juris/liste.jsf?text=${encodeURIComponent('"' + ECLI.replace(/^ECLI:/, "") + '"')}&language=${UI_EN ? "en" : "de"}` });
      links.push({ text: T("Verfahrensübersicht", "Case overview"), href: `${location.origin}/juris/liste.jsf?critereEcli=${encodeURIComponent(ECLI)}&language=${UI_EN ? "en" : "de"}` });
    }
    let t = null;
    try { t = await teile(); } catch (e) { t = null; }
    // Aktenzeichen für die Anzeige wie in der Fundstelle (bei Schlussanträgen nicht das der Verbindung, N1)
    const az = l?.zeile && t ? (t.az ? CPZitier.azText(t.az, UI_EN ? "en" : "de") : t.gutachtenNr ? l.titelAz : null) : null;
    return { en: UI_EN, url: location.href, ecli: ECLI, name: l?.name || null, zeile: [az, ECLI, l?.stand].filter(Boolean).join(" · "), stil: stil(),
             teile: t, beispielNr: RN[0]?.nr || null, links, gliederung: gliederungDaten() };
  }
  if (nachrichten) {
    nachrichten.addListener((m, absender, antwort) => {
      if (m?.an !== "cp-seite") return;
      if (m.typ === "daten") { if ("ui" in m) setzeUi(m.ui); daten().then(antwort, () => antwort(null)); return true; }
      if (m.typ === "springe") { document.getElementById(m.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); antwort(true); }
    });
    chrome.storage?.onChanged?.addListener((ch) => {
      if (ch.zitierstil) STIL = ch.zitierstil.newValue || null;
      if (ch.ui) { setzeUi(ch.ui.newValue); beschrifte(); if (fensterFuer) zeigeFenster(fensterFuer); }
    });
  }
  document.body.append(fenster, auswahlKnopf, meldung);
  beschrifte();
  (async () => {
    const ui = await speicher.lies("ui", null);
    if (ui) { setzeUi(ui); beschrifte(); }
    STIL = await speicher.lies("zitierstil", null);
  })();

  if (!globalThis.chrome?.runtime?.id) globalThis.__cpTest = { fundstelle, kopiereFundstelle, ladeStelle, daten, RN, KOPF, DOCLANG, setStil: (s) => { STIL = s; }, setUi: setzeUi, teile };
})();
