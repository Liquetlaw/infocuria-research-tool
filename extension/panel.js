// Seitenbereich (Chrome Side Panel): Zitierstil, Verfahren und Gliederung zur aktiven InfoCuria-Dokumentseite.
// Die Angaben liefert content.js der Seite; der Seitenbereich selbst ruft nichts aus dem Netz ab.
"use strict";
const $ = (s) => document.querySelector(s);
const Z = globalThis.CPZitier;
let EN = (navigator.language || "de").toLowerCase().startsWith("en");
let UI = null;                       // gespeicherte Sprache der Oberfläche („de“/„en“) oder null = wie die Seite
let STIL = null;                     // gespeicherter Zitierstil
let BAU_OFFEN = false;
let LAUF = 0;                        // Laufnummer von zeige(): nur der zuletzt gestartete Lauf zeichnet (K5)
let GEZEIGT = null;                  // Tab-ID, deren Angaben gerade zu sehen sind
const T = (de, en) => (EN ? en : de);
const el = (tag, attrs = {}, ...kinder) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kinder) if (k) e.append(k);
  return e;
};
const option = (wert, text, gewaehlt) => el("option", { value: wert, text, selected: wert === gewaehlt });
let zeit;
function melde(text) { const m = $("#meldung"); m.textContent = text; m.classList.add("an"); clearTimeout(zeit); zeit = setTimeout(() => m.classList.remove("an"), 3000); }

async function aktiverTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
async function frage(tabId, typ, extra = {}) {
  if (!tabId) return null;
  try { return await chrome.tabs.sendMessage(tabId, { an: "cp-seite", typ, ...extra }); } catch (e) { return null; }
}
async function speichere(werte) { await chrome.storage.local.set(werte); }

// ---------- Oberflächensprache ----------
function sprachwahl() {
  const s = el("select", { "aria-label": "Sprache / Language" },
    option("", T("Sprache wie die Seite", "Language as the page"), UI || ""), option("de", "Deutsch", UI || ""), option("en", "English", UI || ""));
  s.addEventListener("change", async () => { UI = s.value || null; await speichere({ ui: UI }); setTimeout(zeige, 150); });
  return el("div", { class: "kopfzeile" }, s);
}

// ---------- Zitierstil ----------
function stilEditor(d) {
  const stil = Z.kopie(STIL);
  const kasten = el("div", { class: "stil" });
  const vorschau = el("p", { class: "beispiel", "aria-live": "polite" });
  const vorschauZitat = el("p", { class: "leise klein" });
  const hinweis = el("p", { class: "hinweis", "aria-live": "polite" });   // fehlende Angaben (K1)
  const hinweise = () => Z.hinweisTexte(d.teile, stil, EN);
  const zeigeVorschau = () => {
    // Ohne Angaben zur Entscheidung oder bei leerer Fundstelle: keine Vorschau, kein Kopierknopf, nur der Hinweis (N4)
    const f = d.ohneTeile ? "" : Z.formatiere(d.teile, stil, null);
    const fNr = d.ohneTeile ? "" : Z.formatiere(d.teile, stil, d.beispielNr);
    vorschau.textContent = fNr; vorschau.hidden = !f;
    vorschauZitat.textContent = f ? Z.mitZitat(T("…", "…"), fNr, stil) : ""; vorschauZitat.hidden = !f;
    kopieren.hidden = !f;
    const h = hinweise();
    if (!f && !h.length) h.push(T("Die Fundstelle ist leer (alle Bausteine aus oder ohne Angaben).", "The citation is empty (all elements off or without details)."));
    hinweis.textContent = h.length ? T("Unvollständig: ", "Incomplete: ") + h.join("; ") : "";
    hinweis.hidden = !h.length;
  };
  async function aendere(auto = false) { stil.auto = auto; STIL = Z.kopie(stil); await speichere({ zitierstil: STIL }); vorlage.value = Z.vorlageVon(stil) || ""; zeigeVorschau(); }

  const vk = Z.vorlageVon(stil);
  const vorlage = el("select", { "aria-label": T("Vorlage", "Template") },
    ...Object.entries(Z.VORLAGEN).map(([k, v]) => option(k, v.name[EN ? 1 : 0], vk || "")),
    option("", T("Eigener Stil", "Custom style"), vk || ""));
  vorlage.addEventListener("change", async () => {
    if (!vorlage.value) return;
    Object.assign(stil, Z.kopie(Z.VORLAGEN[vorlage.value].stil));
    await aendere(); baueListe();
  });

  const liste = el("ol", { class: "bausteine" });
  function baueListe() {
    const erstes = stil.bloecke.findIndex((x) => x.an);
    liste.replaceChildren(...stil.bloecke.map((x, i) => {
      const def = Z.BAUSTEINE[x.k];
      const an = el("input", { type: "checkbox", checked: x.an });
      an.addEventListener("change", async () => { x.an = an.checked; await aendere(); baueListe(); });
      const form = el("select", { "aria-label": T("Form", "Form") + ": " + def.name[EN ? 1 : 0] }, ...Object.keys(def.formen).map((k) => option(k, Z.formText(x.k, k, d.teile, d.beispielNr, stil, EN), x.form)));
      form.addEventListener("change", async () => { x.form = form.value; await aendere(); });
      const vor = el("select", { "aria-label": T("Trenner davor", "Separator before") }, ...Object.entries(Z.TRENNER).map(([k, v]) => option(k, v, x.vor)));
      vor.addEventListener("change", async () => { x.vor = vor.value; await aendere(); });
      const schieb = (r) => el("button", { type: "button", class: "pfeil", "aria-label": (r < 0 ? T("nach vorn: ", "move up: ") : T("nach hinten: ", "move down: ")) + def.name[EN ? 1 : 0],
        disabled: r < 0 ? i === 0 : i === stil.bloecke.length - 1, text: r < 0 ? "↑" : "↓",
        onclick: async () => { const j = i + r; [stil.bloecke[i], stil.bloecke[j]] = [stil.bloecke[j], stil.bloecke[i]]; await aendere(); baueListe(); } });
      return el("li", { class: x.an ? "" : "aus" },
        el("div", { class: "zeile" }, el("label", {}, an, " " + def.name[EN ? 1 : 0]), el("span", { class: "pfeile" }, schieb(-1), schieb(1))),
        x.an ? el("div", { class: "formen" }, i === erstes ? null : vor, form) : null);
    }));
  }
  baueListe();

  const zitat = el("select", { "aria-label": T("Markierter Text", "Selected text") },
    option("vor", T("„Text“ (Fundstelle)", "“Text” (citation)"), stil.zitat), option("nach", T("Fundstelle: „Text“", "Citation: “text”"), stil.zitat));
  zitat.addEventListener("change", async () => { stil.zitat = zitat.value; await aendere(); });
  const anf = el("select", { "aria-label": T("Anführungszeichen", "Quotation marks") },
    option("de", "„…“", stil.anf), option("en", "“…”", stil.anf), option("fr", "« … »", stil.anf));
  anf.addEventListener("change", async () => { stil.anf = anf.value; await aendere(); });

  const bau = el("details", { class: "bau", open: BAU_OFFEN }, el("summary", { text: T("Bausteine anpassen", "Customise the elements") }),
    el("p", { class: "leise klein", text: T("Haken: Baustein verwenden. Pfeile: Reihenfolge. Der Trenner „( … )“ setzt den Rest in Klammern.", "Tick: use the element. Arrows: order. The separator “( … )” puts the rest in brackets.") }),
    liste,
    el("label", { class: "feld" }, T("Markierter Text", "Selected text"), zitat),
    el("label", { class: "feld" }, T("Anführungszeichen", "Quotation marks"), anf),
    el("button", { type: "button", class: "textknopf", text: T("Grundeinstellung wiederherstellen", "Restore default"),
      onclick: async () => { Object.assign(stil, Z.standard(EN)); await aendere(true); baueListe(); zitat.value = stil.zitat; anf.value = stil.anf; } }));
  bau.addEventListener("toggle", () => { BAU_OFFEN = bau.open; });

  const kopieren = el("button", { type: "button", class: "knopf", text: T("Fundstelle der Entscheidung kopieren", "Copy citation of the decision") });
  kopieren.addEventListener("click", async () => {
    const f = d.ohneTeile ? "" : Z.formatiere(d.teile, stil, null);
    if (!f) return;
    const h = hinweise();
    try { await navigator.clipboard.writeText(f); melde(T("Kopiert: ", "Copied: ") + f + (h.length ? " – " + T("Unvollständig: ", "Incomplete: ") + h.join("; ") : "")); }
    catch (e) { melde(T("Kopieren nicht möglich.", "Could not copy.")); }
  });
  zeigeVorschau();
  kasten.append(vorlage, vorschau, vorschauZitat, hinweis, kopieren,
    el("p", { class: "leise", text: T("Doppelklick auf eine Randnummer kopiert die Fundstelle mit Randnummer. Text markieren: mit Fundstelle kopieren.", "Double-click a paragraph number to copy its citation. Select text to copy it with the citation.") }),
    bau);
  return kasten;
}

// ---------- Seitenbereich aufbauen ----------
// Mehrere Läufe können sich überholen (Tabwechsel während eines langsamen Abrufs): Jeder Lauf hat eine Nummer,
// veraltete Läufe zeichnen nicht; vor dem Zeichnen muss der abgefragte Tab noch der aktive sein. Eine Navigation im
// selben Tab räumt onUpdated(„loading“) sofort ab. Die URL des Tabs ist ohne Berechtigung „tabs“ nicht lesbar und wird
// darum nicht verglichen (N3); url/ecli der Antwort dienen nur der Anzeige.
async function zeige(wechsel = false) {
  const lauf = ++LAUF;
  const inhalt = $("#inhalt");
  const tab = await aktiverTab();
  if (lauf !== LAUF) return;
  const tabId = tab?.id ?? null;
  if (wechsel === true || tabId !== GEZEIGT) { GEZEIGT = null; inhalt.replaceChildren(el("p", { class: "leise", text: T("Lädt …", "Loading …") })); }
  const gespeichert = await chrome.storage.local.get(["ui", "zitierstil"]);
  if (lauf !== LAUF) return;
  UI = gespeichert.ui || null;
  const d = await frage(tabId, "daten", { ui: UI });
  if (lauf !== LAUF) return;
  const jetzt = await aktiverTab();
  if (lauf !== LAUF || (jetzt?.id ?? null) !== tabId) return;
  GEZEIGT = tabId;
  EN = UI ? UI === "en" : d ? d.en : (navigator.language || "de").toLowerCase().startsWith("en");
  document.documentElement.lang = EN ? "en" : "de";
  STIL = Z.wirksam(gespeichert.zitierstil, EN);
  if (d?.keinText) {
    inhalt.replaceChildren(sprachwahl(), el("p", { class: "leise", text: T(
      "Dieses Dokument ist in der gewählten Sprache nicht als Text verfügbar. Bitte oben auf der InfoCuria-Seite eine andere Sprache wählen.",
      "This document is not available as text in the selected language. Please choose another language at the top of the InfoCuria page.") }));
    return;
  }
  if (!d) {
    inhalt.replaceChildren(sprachwahl(), el("p", { class: "leise", text: T(
      "Öffne ein Urteil, einen Beschluss oder Schlussanträge in der InfoCuria-Rechtsprechung (juris.curia.europa.eu). Ist die Seite schon offen, lade sie einmal neu.",
      "Open a judgment, order or Opinion in the InfoCuria case-law database (juris.curia.europa.eu). If the page is already open, reload it once.") }));
    return;
  }
  if (!d.teile) { d.ohneTeile = true; d.teile = { hinweise: ["fehler"] }; }
  const teile = [sprachwahl()];
  const name = d.teile?.name?.[EN ? "en" : "de"] || d.name;
  if (name) teile.push(el("p", { class: "titel", text: name }));
  if (d.zeile) teile.push(el("p", { class: "leise", text: d.zeile }));
  teile.push(el("h2", { text: T("Zitieren", "Cite") }), stilEditor(d));
  if (d.links.length) {
    teile.push(el("h2", { text: T("Verfahren", "Case") }),
      el("ul", {}, ...d.links.map((l) => el("li", {}, el("a", { href: l.href, onclick: (e) => { e.preventDefault(); oeffne(l.href, l.neu); }, text: l.text })))));
  }
  if (d.gliederung.length) {
    teile.push(el("h2", { text: T("Gliederung", "Outline") }),
      el("nav", {}, el("ul", {}, ...d.gliederung.map((g) => el("li", { class: "e" + g.ebene }, el("a", { href: "#", onclick: (e) => { e.preventDefault(); frage(tabId, "springe", { id: g.id }); }, text: g.text }))))));
  }
  teile.push(el("p", { class: "leise fuss", text: T("Inoffizielle Erweiterung. Alle Angaben stammen von der Seite und aus InfoCuria.", "Unofficial extension. All details come from the page and from InfoCuria.") }));
  inhalt.replaceChildren(...teile);
}
async function oeffne(href, neu) {
  if (neu) { chrome.tabs.create({ url: href }); return; }
  const t = await aktiverTab(); if (t?.id) chrome.tabs.update(t.id, { url: href });
}

chrome.tabs.onActivated.addListener(() => zeige(true));
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (!tab.active) return;
  // Neue Seite im selben Tab: alte Angaben sofort entfernen, damit nichts Veraltetes kopiert wird
  if (info.status === "loading") { LAUF++; GEZEIGT = null; $("#inhalt").replaceChildren(el("p", { class: "leise", text: T("Lädt …", "Loading …") })); }
  if (info.status === "complete") setTimeout(zeige, 300);
});
zeige();
