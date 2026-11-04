// Hunting seasons in Blekinge län, from Jaktförordningen (1987:905) bilaga 1–4 as amended up to SFS 2026:1693
// (the version that applies until 30 June 2027), plus the shooting-light rules in 9 §.
// Dates are "MM-DD"; "02-29" means the last day of February. A period may run over New Year.
(function (root) {
  "use strict";
  const SV = "Endast smyg- eller vaktjakt";
  const HOOF = "hoof", FOWL = "fowl";
  const SPECIES = [
    // klövvilt
    { n: "Älg", en: "moose elk", g: "Klövvilt", light: HOOF, p: [["10-08", "01-31"]],
      cats: [{ n: "Tjur", p: [["10-08", "01-31"]] }, { n: "Ko", p: [["10-08", "01-31"]] }, { n: "Kalv", p: [["10-08", "01-31"]] }],
      today: "Bara enligt tilldelning i licens- eller älgskötselområde.",
      note: "Jakt på vuxna djur kräver licens- eller älgskötselområde med tilldelning. Utanför sådana områden: bara kalv, i fem dagar från 8 okt." },
    { n: "Rådjur", en: "roe deer", g: "Klövvilt", light: HOOF, p: [["10-01", "01-31"]],
      cats: [{ n: "Bock", p: [["10-01", "01-31"], ["08-16", "09-30", SV], ["05-01", "06-15", SV]] }, { n: "Get", p: [["10-01", "01-31"]] },
        { n: "Kid", p: [["10-01", "01-31"], ["09-01", "09-30", SV]] }], sub: [
      { n: "bock (hornbärande)", p: [["08-16", "09-30", SV], ["05-01", "06-15", SV]] },
      { n: "kid", p: [["09-01", "09-30", SV]] }] },
    { n: "Vildsvin", en: "wild boar pig", g: "Klövvilt", p: [["04-01", "01-31"]], note: "Inte sugga som följs av randiga eller bruna små kultingar.",
      cats: [{ n: "Galt", p: [["04-01", "01-31"]] }, { n: "Sugga", p: [["04-01", "01-31"]], note: "inte med små randiga eller bruna kultingar" }, { n: "Årsunge", p: [["07-01", "06-30"]] }], sub: [
      { n: "årsunge", p: [["07-01", "06-30"]] }] },
    { n: "Dovhjort", en: "fallow deer", g: "Klövvilt", light: HOOF, p: [["10-01", "10-20"], ["11-16", "02-29"]],
      cats: [{ n: "Hjort", p: [["10-01", "10-20"], ["11-16", "02-29"], ["09-01", "09-30", SV]] },
        { n: "Hind", p: [["10-01", "10-20"], ["10-21", "11-15"], ["11-16", "02-29"], ["03-01", "03-31", SV]] },
        { n: "Kalv", p: [["10-01", "10-20"], ["10-21", "11-15"], ["11-16", "02-29"], ["09-01", "09-30", SV], ["03-01", "03-31", SV]] }], sub: [
      { n: "hornbärande djur och kalv", p: [["09-01", "09-30", SV]] },
      { n: "hind och kalv", p: [["10-21", "11-15"], ["03-01", "03-31", SV]] }] },
    { n: "Kronhjort", en: "red deer", g: "Klövvilt", light: HOOF, p: [], note: "Utanför kronhjortsskötselområde bara årskalv. Vuxna djur: inom kronhjortsskötselområde.",
      cats: [{ n: "Årskalv", p: [["08-16", "09-30", SV], ["10-01", "01-31"]] },
        { n: "Hjort", p: [["10-08", "01-31"]], area: true }, { n: "Hind", p: [["08-16", "09-30", SV], ["10-01", "01-31"], ["02-01", "02-29", SV]], area: true }],
      today: "Hjort och hind bara inom kronhjortsskötselområde.", sub: [
      { n: "årskalv", p: [["08-16", "09-30", SV], ["10-01", "01-31"]] },
      { n: "hjort, i kronhjortsskötselområde", p: [["10-08", "01-31"]] },
      { n: "hind och årskalv, i kronhjortsskötselområde", p: [["08-16", "09-30", SV], ["10-01", "01-31"], ["02-01", "02-29", SV]] }] },
    { n: "Sikahjort", en: "sika deer", g: "Klövvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året för att förhindra skador." },
    { n: "Mufflonfår", en: "mouflon", g: "Klövvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året för att förhindra skador." },
    { n: "Vitsvanshjort", en: "white-tailed deer", g: "Klövvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året för att förhindra skador." },
    // rovdjur och småvilt
    { n: "Rödräv", en: "red fox", g: "Rovdjur och småvilt", p: [["08-01", "02-29"]] },
    { n: "Grävling", en: "badger", g: "Rovdjur och småvilt", p: [["08-01", "01-31"]] },
    { n: "Fälthare", en: "brown hare european", g: "Rovdjur och småvilt", p: [["09-01", "02-29"]] },
    { n: "Skogshare", en: "mountain hare", g: "Rovdjur och småvilt", p: [["09-01", "02-29"]] },
    { n: "Bäver", en: "beaver", g: "Rovdjur och småvilt", p: [["10-01", "05-10"]] },
    { n: "Mård (skogsmård)", en: "pine marten", g: "Rovdjur och småvilt", p: [["09-01", "02-29"]] },
    { n: "Iller", en: "polecat", g: "Rovdjur och småvilt", p: [["09-01", "02-29"]] },
    { n: "Mårdhund", en: "raccoon dog", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Mink", en: "mink", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Tvättbjörn", en: "raccoon", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Vildkanin", en: "rabbit", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Stenmård", en: "stone marten", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Bisam", en: "muskrat", g: "Rovdjur och småvilt", p: [["07-01", "06-30"]], note: "Främmande art: får jagas hela året." },
    { n: "Björn", en: "bear", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Bara licens- eller skyddsjakt efter beslut." },
    { n: "Varg", en: "wolf", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Bara licens- eller skyddsjakt efter beslut." },
    { n: "Lo", en: "lynx", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Bara licens- eller skyddsjakt efter beslut." },
    { n: "Järv", en: "wolverine", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Bara skyddsjakt efter beslut." },
    { n: "Gråsäl", en: "grey seal", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Licensjakt efter Naturvårdsverkets beslut." },
    { n: "Knubbsäl", en: "harbour seal", g: "Rovdjur och småvilt", p: [], none: "Ingen allmän jakt. Bara skyddsjakt efter beslut." },
    // fågel
    { n: "Gräsand", en: "mallard duck", g: "Fågel", light: FOWL, p: [["08-21", "12-31"]] },
    { n: "Bläsand", en: "wigeon duck", g: "Fågel", light: FOWL, p: [["08-21", "12-31"]] },
    { n: "Kricka", en: "teal duck", g: "Fågel", light: FOWL, p: [["08-21", "12-31"]] },
    { n: "Knipa", en: "goldeneye duck", g: "Fågel", light: FOWL, p: [["08-21", "01-31"]] },
    { n: "Storskrake", en: "goosander merganser", g: "Fågel", light: FOWL, p: [["08-21", "01-31"]] },
    { n: "Vigg", en: "tufted duck", g: "Fågel", light: FOWL, p: [["08-21", "01-31"]] },
    { n: "Sjöorre", en: "common scoter", g: "Fågel", light: FOWL, p: [["09-21", "01-31"]] },
    { n: "Grågås", en: "greylag goose", g: "Fågel", light: FOWL, p: [["08-11", "01-31"]] },
    { n: "Kanadagås", en: "canada goose", g: "Fågel", light: FOWL, p: [["08-11", "01-31"]] },
    { n: "Bläsgås", en: "white-fronted goose", g: "Fågel", p: [], none: "Ingen allmän jakt i Blekinge (bara i Skåne)." },
    { n: "Orre och tjäder", en: "black grouse capercaillie", g: "Fågel", p: [["08-25", "09-30"]], sub: [
      { n: "orrtupp och tjädertupp", p: [["01-01", "01-31"]] }] },
    { n: "Järpe", en: "hazel grouse", g: "Fågel", p: [], none: "Ingen allmän jakt i Blekinge (bara i norra Sverige)." },
    { n: "Dalripa och fjällripa", en: "ptarmigan willow grouse", g: "Fågel", p: [], none: "Ingen allmän jakt i Blekinge." },
    { n: "Rapphöna", en: "grey partridge", g: "Fågel", p: [["09-16", "11-30"]] },
    { n: "Fasan", en: "pheasant", g: "Fågel", p: [["10-01", "01-31"]] },
    { n: "Morkulla", en: "woodcock", g: "Fågel", p: [["09-11", "12-31"]] },
    { n: "Ringduva", en: "wood pigeon", g: "Fågel", p: [["08-16", "12-31"]] },
    { n: "Kaja, kråka och skata", en: "jackdaw crow magpie", g: "Fågel", p: [["07-01", "04-15"]] },
    { n: "Nötskrika", en: "jay", g: "Fågel", p: [["08-21", "03-10"]] },
    { n: "Fiskmås", en: "common gull", g: "Fågel", p: [["08-11", "02-29"]] },
    { n: "Gråtrut", en: "herring gull", g: "Fågel", p: [["08-01", "03-31"]] },
    { n: "Råka", en: "rook", g: "Fågel", p: [], none: "Ingen allmän jakt i Blekinge (bara Skåne och Halland)." },
    { n: "Ejder", en: "eider", g: "Fågel", p: [], none: "Ingen allmän jakt." },
  ];

  const MONTHS = ["jan.", "feb.", "mars", "april", "maj", "juni", "juli", "aug.", "sept.", "okt.", "nov.", "dec."];
  function md(s) { const [m, d] = s.split("-").map(Number); return { m, d }; }
  function dayNum(m, d) { return m * 100 + d; }
  function label(s) { const { m, d } = md(s); return m === 2 && d === 29 ? "28 (29) feb." : `${d} ${MONTHS[m - 1]}`; }
  function periodText(p) { return p[0] === "07-01" && p[1] === "06-30" ? "Hela året" : `${label(p[0])} – ${label(p[1])}`; }
  function inPeriod(p, date) {
    const a = md(p[0]), b = md(p[1]), t = dayNum(date.getMonth() + 1, date.getDate());
    const A = dayNum(a.m, a.d), B = dayNum(b.m, b.d === 29 && b.m === 2 ? 29 : b.d);
    return A <= B ? t >= A && t <= B : t >= A || t <= B;
  }
  // Is anything about this species open on this date? Returns { open, note } and the next start when closed.
  function status(sp, date) {
    const all = [...sp.p.map((p) => ({ p, who: "" })), ...(sp.sub || []).flatMap((s) => s.p.map((p) => ({ p, who: s.n })))];
    if (!all.length) return { open: false, never: true };
    const now = all.filter((x) => inPeriod(x.p, date));
    if (now.length) return { open: true, partial: now.every((x) => x.who) ? now.map((x) => x.who).join(", ") : "", only: now.every((x) => x.p[2]) ? SV : "" };
    let next = null, best = Infinity;
    for (const x of all) {
      const s = md(x.p[0]), cand = new Date(date.getFullYear(), s.m - 1, s.d);
      if (cand < date) cand.setFullYear(cand.getFullYear() + 1);
      const diff = cand - date; if (diff < best) { best = diff; next = x.p[0]; }
    }
    return { open: false, next };
  }
  // open today for one kind of animal: { open, only (smyg/vakt only), until (end of the open period), next (start when closed) }
  function catStatus(cat, date) {
    const now = cat.p.filter((p) => inPeriod(p, date));
    if (now.length) {
      const full = now.find((p) => !p[2]);
      // follow on through periods that start the next day (hind: 21 okt-15 nov, then 16 nov-28 feb)
      let until = (full || now[0])[1];
      for (let k = 0; k < 4; k++) {
        const e = md(until), next = new Date(2001, e.m - 1, e.d + (e.m === 2 && e.d === 29 ? 0 : 1)), key = `${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        const cont = cat.p.find((p) => p[0] === key && !!p[2] === !full);
        if (!cont) break; until = cont[1];
      }
      return { open: true, only: !full, until };
    }
    return { open: false, next: status({ p: cat.p }, date).next };
  }
  root.Jakttider = { SPECIES, status, catStatus, periodText, label, SV, HOOF, FOWL,
    source: "Jaktförordningen (1987:905) bilaga 1–4, ändrad t.o.m. SFS 2026:1693. Gäller till 30 juni 2027." };
})(window);
