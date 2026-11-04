// Swedish translation layer. The app is written in English; when Swedish is chosen (the default), every piece of
// text that reaches the page is translated as it appears: exact phrases from the dictionary, phrases with numbers
// through patterns, and " · "-joined parts one by one. Names people type (stands, places, notes) pass through
// unchanged unless they happen to equal a dictionary phrase.
(function (root) {
  "use strict";
  let lang = "sv";
  try { const p = JSON.parse(localStorage.getItem("alnaryd-prefs") || "null"); if (p && p.lang) lang = p.lang; } catch { /* default */ }
  if (location.search.includes("shot=") && !location.search.includes("lang=sv")) lang = location.search.includes("lang=en") ? "en" : lang;

  const COMPASS = { N: "N", NNE: "NNÖ", NE: "NÖ", ENE: "ÖNÖ", E: "Ö", ESE: "ÖSÖ", SE: "SÖ", SSE: "SSÖ", S: "S", SSW: "SSV", SW: "SV",
    WSW: "VSV", W: "V", WNW: "VNV", NW: "NV", NNW: "NNV" };
  const DAYS = { Mon: "mån", Tue: "tis", Wed: "ons", Thu: "tors", Fri: "fre", Sat: "lör", Sun: "sön", Today: "Idag", Tomorrow: "Imorgon" };
  const C = (x) => COMPASS[x] || x;

  const SV = {
    // header, tabs, panels
    "Alnaryd Hunting Map": "Alnaryd jaktkarta", "Map controls": "Kartinställningar", "Expand or collapse panel": "Fäll ut eller ihop panelen",
    "Hunting map": "Jaktkarta", "Where your stands and sightings are saved": "Var dina pass och observationer sparas",
    "Saved on this device": "Sparas på den här enheten", "Synced to your account": "Synkat till ditt konto", "Loading saved data…": "Hämtar sparad data…",
    "Can't reach saved data yet": "Når inte sparad data än", "Saved data unavailable": "Sparad data är inte tillgänglig",
    "Panel sections": "Panelens delar", "Map": "Karta", "Wind": "Vind", "Stands": "Pass", "Sightings": "Observationer", "Family": "Familj",
    // map tab
    "Ground": "Grundkarta", "Base map": "Grundkarta", "Forest types": "Skogstyper", "Terrain relief": "Terräng", "Tree height": "Trädhöjd",
    "Layers": "Lager", "Our trails & places": "Våra stigar och platser", "Contours": "Höjdkurvor", "Roads, tracks & paths": "Vägar, traktorvägar och stigar",
    "Alnaryd nature reserve": "Alnaryds naturreservat", "Your hunting boundary": "Jaktgränsen", "Wet ground": "Blöt mark", "mires, wet hollows": "myrar, blöta sänkor",
    "Drainage & cold-air flow": "Avrinning och kalluftsflöde", "Steep ground": "Brant terräng", 
    "Boundary": "Jaktgräns",
    "No hunting boundary drawn yet. Use the boundary tool to trace it on the map.": "Ingen jaktgräns ritad än. Använd gränsverktyget för att rita den på kartan.",
    "Adjust points": "Justera punkter", "Draw boundary": "Rita gräns", "Draw new": "Rita ny", "Remove": "Ta bort", "Tap again to remove": "Tryck igen för att ta bort",
    "Trails & places": "Stigar och platser", "Move place names, reshape trails, or add new ones.": "Flytta platsnamn, ändra stigar eller lägg till nya.",
    "Edit trails & places": "Redigera stigar och platser", "Stop editing": "Sluta redigera", "Place": "Plats", "Place name": "Platsnamn", "Name": "Namn",
    "e.g. Ingång Syd": "t.ex. Ingång Syd", "e.g. Mittenvägen": "t.ex. Mittenvägen", "Type": "Typ", "Entrance": "Ingång", "Parking": "Parkering", "Building": "Byggnad",
    "Water": "Vatten", "Moose area": "Älgområde", "Deer area": "Hjortområde", "Boar area": "Vildsvinsområde", "Wallow": "Gyttjebad", "Other name": "Annat namn",
    "Save": "Spara", "Close": "Stäng", "Delete": "Ta bort", "Edit": "Ändra", "Sources": "Källor", "Trail": "Stig",
    "Elevation: Lantmäteriet 1 m laser model (CC0) via Mapterhorn. Land cover: Naturvårdsverket NMD 2023 (CC0). Tree height: Meta & WRI canopy model (CC BY 4.0), imagery about 2018–2020. Roads: © OpenStreetMap contributors. Reserve: Naturvårdsverket.":
      "Höjd: Lantmäteriets laserscannade markmodell 1 m (CC0) via Mapterhorn. Marktäcke: Naturvårdsverket NMD 2023 (CC0). Trädhöjd: Meta & WRI (CC BY 4.0), bilder från cirka 2018–2020. Vägar: © OpenStreetMap. Reservat: Naturvårdsverket.",
    "Bluer shades of the same colour grow on wet ground.": "Blåare nyans av samma färg växer på blöt mark.",
    "Pale patches are open ground or young plantings; dark is tall, old forest.": "Ljusa fläckar är öppen mark eller ung planterad skog, mörkt är hög, gammal skog.",
    "Laser-scanned ground with the trees removed, lit from the northwest. Ditches, stone walls, boulders and old tracks stand out.":
      "Laserscannad mark utan träd, belyst från nordväst. Diken, stenmurar, block och gamla vägar syns tydligt.",
    "Language": "Språk",
    // forest legend and land cover
    "Spruce": "Gran", "Pine": "Tall", "Mixed conifer": "Barrblandskog", "Conifer + broadleaf": "Barr + löv", "Birch, aspen, alder": "Björk, asp, al",
    "Beech & oak (mast)": "Bok och ek (ollon)", "Broadleaf mix": "Lövblandning", "Clearcut, regrowth": "Hygge, ungskog", "Open mire": "Öppen myr",
    "Grass, heath": "Gräs, ljung", "Arable": "Åker",
    "Arable land": "Åkermark", "Developed ground": "Bebyggd mark", "Road or railway": "Väg eller järnväg", "Peat cutting": "Torvtäkt", "Lake or stream": "Sjö eller bäck",
    "Sea": "Hav", "Pine forest": "Tallskog", "Spruce forest": "Granskog", "Conifer with broadleaf": "Barrskog med löv", "Beech and oak": "Bok och ek",
    "Broadleaf with beech/oak": "Lövskog med bok/ek", "Clearcut or young regrowth": "Hygge eller ungskog", "Open wetland": "Öppen våtmark", "Shrub mire": "Buskmyr",
    "Dwarf-shrub bog": "Ristuvemyr", "Poor fen": "Fattigkärr", "Rich fen": "Rikkärr", "Marsh": "Sumpkärr", "Soft mire": "Mjukmattemyr", "Bare wetland": "Våtmark utan växter",
    "Wetland with shrubs": "Våtmark med buskar", "Heathy wetland": "Risdominerad våtmark", "Grassy wetland": "Gräsdominerad våtmark",
    "Lush grassy wetland": "Frodig gräsvåtmark", "Tall-grass wetland": "Högvuxen gräsvåtmark", "Moss wetland": "Mossdominerad våtmark",
    "Mud-bottom wetland": "Lösbottnad våtmark", "Bare rock or open ground": "Berg eller öppen mark", "Scrub, dry": "Buskmark, torr", "Scrub": "Buskmark",
    "Scrub, moist": "Buskmark, fuktig", "Heath, dry": "Ljunghed, torr", "Heath": "Ljunghed", "Heath, moist": "Ljunghed, fuktig", "Grassland, dry": "Gräsmark, torr",
    "Grassland": "Gräsmark", "Grassland, moist": "Gräsmark, fuktig", "Unclassified": "Oklassad",
    // wind tab
    "Loading SMHI forecast…": "Hämtar SMHI-prognos…", "Use SMHI forecast": "Använd SMHI-prognos", "Hourly wind forecast": "Vindprognos per timme",
    "Wind direction (where the wind comes from)": "Vindriktning (varifrån vinden kommer)", "Wind speed": "Vindstyrka",
    
    
    "Set by hand": "Inställd för hand", "The SMHI forecast can't be loaded here. Set the wind with the dial.": "SMHI-prognosen kan inte hämtas här. Ställ in vinden med ratten.",
    
    
    "Calm": "Stiltje",
    // stands
    "Place a stand": "Placera pass", "Plan stalk route": "Planera smygrutt", "Stand": "Pass", "New stand": "Nytt pass", "Edit stand": "Ändra pass",
    "e.g. Tornet vid hygget": "t.ex. Tornet vid hygget", "Tower / high seat": "Torn", "Ladder stand": "Stege", "Ground blind": "Markpass", "Drive post (pass)": "Drevpass",
    "Drive post": "Drevpass", "Seat height (m)": "Sitthöjd (m)", "Facing": "Riktning", "Shooting sector": "Skjutsektor", "Max shooting distance": "Max skjutavstånd",
    "Show what I can see from here": "Visa vad jag ser härifrån", "Looking for": "Letar efter", "roe deer, boar": "rådjur, vildsvin", "fallow, red deer": "dovhjort, kronhjort",
    "moose": "älg", "No colour: you can see it, a miss hits the ground": "Ingen färg: syns, en bom tas av marken",
    "Yellow stripes: you can see it, but a miss flies on": "Gula ränder: syns, men en bom flyger vidare",
    "Purple stripes: hidden behind a hill or in a hollow": "Lila ränder: dolt bakom en höjd eller i en sänka", "Dark: hidden by thick forest": "Mörkt: dolt av tät skog",
    "Notes": "Anteckningar",
    "Approach from the track, sit before 16:00…": "Gå in från traktorvägen, sitt på plats före 16:00…", "Save stand": "Spara pass",
    "Stalk routes": "Smygrutter", "Stalk route": "Smygrutt",
    "Calm, swirling": "Stiltje, virvlar", "Scent into sector": "Vittring i sektorn", "Side wind": "Sidvind", "Good wind": "Bra vind",
    "Unnamed stand": "Namnlöst pass", 
    "Stand saved": "Passet sparat", "Stand updated": "Passet uppdaterat", "Route saved. Its colours follow the wind you set.": "Rutten sparad. Färgerna följer vinden du ställt in.",
    "Confirm": "Bekräfta",
    // sightings
    "Log a sighting": "Logga observation", "Filter sightings by species": "Filtrera observationer per art", "Sighting": "Observation", "Species": "Art", "Count": "Antal",
    "When": "När", "What": "Vad", "Seen": "Sett", "Heard": "Hört (ljud)", "Shot": "Skjuten", "Tracks / sign": "Spår / tecken", "Bed / daybed": "Liga / dagliga", "Rub / wallow": "Fejning / gyttjebad",
    "Cow with calf heading north along the ditch": "Ko med kalv på väg norrut längs diket", "Save sighting": "Spara observation", "Sighting saved": "Observationen sparad",
    "All species": "Alla arter", "Moose": "Älg", "Roe deer": "Rådjur", "Fallow deer": "Dovhjort", "Red deer": "Kronhjort", "Wild boar": "Vildsvin", "Fox": "Räv", "Bird": "Fågel",
    "Other": "Annat", 
    "No sightings of this species yet.": "Inga observationer av den här arten än.",
    "No sightings yet. Log what you see, where and in which wind, and patterns show up over a season.": "Inga observationer än. Logga vad du ser, var och i vilken vind, så syns mönster över säsongen.",
    // family
    "Share my position": "Dela min position", "Off. Your family can't see you.": "Av. Familjen kan inte se dig.",
    "On. Your family sees you while this map is open. Keep the screen on.": "På. Familjen ser dig medan kartan är öppen. Håll skärmen tänd.",
    "On. Waiting for GPS…": "På. Väntar på GPS…", "Add someone": "Lägg till någon", "Email": "E-post",
    "They open the map, tap “First time? Create your password” and use this email.": "De öppnar kartan, trycker på ”Första gången? Skapa ditt lösenord” och använder den här e-posten.",
    "Add to family": "Lägg till i familjen", "Import map data": "Importera kartdata", "Load stands, trails, place names and the boundary from an export file.": "Läs in pass, stigar, platsnamn och gräns från en exportfil.",
    "Your account": "Ditt konto", "Sign out": "Logga ut", "Nobody added yet.": "Ingen tillagd än.", "owner": "ägare", "You": "Du", "sharing now": "delar nu",
    "waiting for GPS…": "väntar på GPS…", "not sharing": "delar inte", "Hasn't shared yet": "Har inte delat än", "Sharing": "Delar", "now": "nu", "Signed in": "Inloggad",
    "That email address doesn't look right.": "E-postadressen ser inte rätt ut.", "Couldn't add them. Check your connection.": "Kunde inte lägga till. Kontrollera anslutningen.",
    "That file isn't a map export.": "Filen är ingen kartexport.", "Import failed. Only the owner can import.": "Importen misslyckades. Bara ägaren kan importera.",
    "Couldn't remove. Try again.": "Kunde inte ta bort. Försök igen.",
    // sign-in
    "Family hunting map": "Familjens jaktkarta", "Loading…": "Laddar…", "Your name": "Ditt namn", "Password": "Lösenord", "Sign in": "Logga in",
    "First time? Create your password": "Första gången? Skapa ditt lösenord", "I already have a password": "Jag har redan ett lösenord", "Forgot password?": "Glömt lösenordet?",
    "Create account": "Skapa konto", "We sent a link to": "Vi har skickat en länk till", ". Open it to confirm your email, then come back and tap Continue.": ". Öppna den för att bekräfta din e-post, kom sedan tillbaka och tryck på Fortsätt.",
    "Continue": "Fortsätt", "Send again": "Skicka igen", "Use another email": "Använd en annan e-post",
    "isn't on the family list yet. Ask the map owner to add it under Family, then tap Try again.": "finns inte på familjelistan än. Be kartans ägare lägga till den under Familj och tryck sedan på Försök igen.",
    "Try again": "Försök igen", "Wrong email or password.": "Fel e-post eller lösenord.", "No account with that email yet. Tap “First time?” to create one.": "Inget konto med den e-posten än. Tryck på ”Första gången?” för att skapa ett.",
    "That email already has an account. Sign in instead.": "Den e-posten har redan ett konto. Logga in i stället.", "Use at least 6 characters.": "Använd minst 6 tecken.",
    "Too many tries. Wait a minute and try again.": "För många försök. Vänta en minut och försök igen.", "No connection. Try again when you have signal.": "Ingen anslutning. Försök igen när du har täckning.",
    "Something went wrong. Try again.": "Något gick fel. Försök igen.", "Type your email first, then tap “Forgot password?”.": "Skriv din e-post först och tryck sedan på ”Glömt lösenordet?”.",
    "Not verified yet. Open the link in the email, then tap Continue.": "Inte bekräftat än. Öppna länken i mejlet och tryck sedan på Fortsätt.",
    "Sent again. Check spam too.": "Skickat igen. Kolla skräpposten också.",
    // toolbar, hints, compass
    "Map of the hunting ground": "Karta över jaktmarken", "Map tools": "Kartverktyg", "Measure distance": "Mät avstånd",
    "Show my position": "Visa min position", "Back to the hunting ground": "Tillbaka till jaktmarken",
    "Add trail": "Lägg till stig", "Add place": "Lägg till plats", "Undo": "Ångra", "Delete point": "Ta bort punkt", "Finish": "Klar", "Cancel": "Avbryt", "Done": "Klar", "Clear": "Rensa",
    "Tap to turn the map north up": "Tryck för att vrida kartan med norr uppåt", "Compass. Tap to turn the map north up": "Kompass. Tryck för att vrida kartan med norr uppåt",
    "Open the wind tab": "Öppna vindfliken", "What you can see from the stand": "Det här ser du från passet",
    "Loading terrain…": "Laddar terräng…", "Tap the map where the stand is": "Tryck på kartan där passet står", "Tap where you saw it": "Tryck där du såg det",
    "Tap to add points along your stalk": "Tryck för att lägga till punkter längs smygrutten", "Tap points to measure": "Tryck ut punkter för att mäta",
    "Tap the corners of your hunting area": "Tryck ut hörnen på jaktmarken", "Tap points along the new trail": "Tryck ut punkter längs den nya stigen",
    "Tap where the name should go": "Tryck där namnet ska stå", "Drag a name to move it, tap it to rename. Tap a trail to reshape it.": "Dra ett namn för att flytta det, tryck för att byta namn. Tryck på en stig för att ändra den.",
    "Trail saved": "Stigen sparad", "Trail added. Give it a name if you like.": "Stigen tillagd. Ge den ett namn om du vill.", "New place": "Ny plats",
    "Drag the name on the map to move it.": "Dra namnet på kartan för att flytta det.", "Drag the points on the map to reshape it, then Save.": "Dra punkterna på kartan för att ändra den och tryck sedan på Spara.",
    "Place saved": "Platsen sparad", "Tap again to delete": "Tryck igen för att ta bort", "Place deleted": "Platsen borttagen", "Trail deleted": "Stigen borttagen",
    "This browser can't share your position.": "Den här webbläsaren kan inte dela din position.",
    
    "This device has no compass.": "Den här enheten har ingen kompass.", "Compass access was refused. Close the app and open it again to be asked again.": "Kompassen nekades. Stäng appen och öppna den igen för att få frågan igen.",
    "Couldn't save. Check your connection.": "Kunde inte spara. Kontrollera anslutningen.", "Storage is full. Delete old sightings to make room.": "Lagringen är full. Ta bort gamla observationer.",
    "Couldn't save. Check your connection and try again.": "Kunde inte spara. Kontrollera anslutningen och försök igen.", "Couldn't delete. Try again.": "Kunde inte ta bort. Försök igen.",
    "Couldn't save the boundary. Try again.": "Kunde inte spara gränsen. Försök igen.", "Map data didn't load. Reload the page.": "Kartdata laddades inte. Ladda om sidan.",
    // tap-to-inspect popup
    "Elevation": "Höjd", 
    "Wet": "Blött", 
    "just now": "nyss", "App version:": "Appversion:", "Log": "Obs", "Edit the map": "Redigera kartan", "Settings": "Inställningar", 
    "3D height exaggeration": "Höjdförstärkning i 3D", "3D terrain": "3D-terräng", "Adjust by hand": "Ställ in för hand",
    "Add or draw": "Lägg till eller rita", "Coordinates": "Koordinater", "Copy coordinates": "Kopiera koordinater", "Coordinates:": "Koordinater:", "No position for them yet.": "Ingen position för personen än.", "Animal near me": "Djur nära mig", "Map marker": "Kartmarkör", "Notifications": "Aviseringar", "Send a test": "Skicka ett test", "Tap to see it on the map": "Tryck för att se på kartan",
    "Test from the hunting map": "Test från jaktkartan", "Notifications work on this phone.": "Aviseringarna fungerar på den här telefonen.",
    "Test sent. It should arrive in a few seconds.": "Test skickat. Det ska komma inom några sekunder.", "Couldn't reach ntfy. Check your connection.": "Nådde inte ntfy. Kolla anslutningen.",
    "Shots, \"need help\", \"animal near me\" and the hunt day buzz on your phone even when the map is closed, through the free ntfy app. Set it up once on each phone:": "Skott, \"behöver hjälp\", \"djur nära mig\" och jaktdagen plingar i telefonen även när kartan är stängd, via gratisappen ntfy. Ställ in en gång på varje telefon:",
    "Install the free app": "Installera gratisappen", "(Android: Google Play).": "(Android: Google Play).", "Copy my channel": "Kopiera min kanal",
    "In ntfy tap": "Tryck på", ", paste it as the topic and tap Subscribe. Allow notifications when asked.": " i ntfy, klistra in den som topic och tryck Subscribe. Tillåt notiser när den frågar.",
    "It should buzz within a few seconds.": "Det ska plinga inom några sekunder.", "Your channel:": "Din kanal:", "Only for you; you won't get your own messages.": "Bara för dig; du får inte dina egna meddelanden.",
    "Has a channel:": "Har kanal:", "Making your channel…": "Skapar din kanal…", "Copied. Paste it in ntfy.": "Kopierat. Klistra in i ntfy.", "Quiet ground": "Tyst mark", "for stalking": "för smygjakt", "Quiet: spruce, moss, tracks": "Tyst: gran, mossa, stigar",
    "Some noise: pine, birch, grass": "Lite ljud: tall, björk, gräs", "Loud: dry oak and beech leaves, thickets, clearcuts": "Högljutt: torra ek- och boklöv, sly, hyggen",
    "Dry or wet": "Torrt eller blött", "Auto": "Auto", "Dry": "Torrt", "Wet": "Blött",
    "After rain the leaves are much quieter. Auto picks from SMHI's measured rain. Built from forest data, not walked.": "Efter regn är löven mycket tystare. Auto väljer efter SMHI:s uppmätta regn. Byggt på skogsdata, inte inventerat.",
    "Showing dry ground (chosen)": "Visar torr mark (valt)", "Showing wet ground (chosen)": "Visar blöt mark (valt)", "Frost: frozen leaves crunch": "Frost: frusna löv knastrar",
    "Raining: wet ground": "Regnar: blöt mark", "Wet after rain": "Blött efter regn", "Dry ground": "Torr mark", "Dry ground (no rain data)": "Torr mark (regndata saknas)", "You (OwnTracks)": "Du (OwnTracks)", "The map's own GPS not working?": "Fungerar inte kartans egen GPS?",
    "Only needed for the blue dot, follow-me and the compass while the map is open. OwnTracks works without it.": "Behövs bara för den blå pricken, följ mig och kompassen medan kartan är öppen. OwnTracks fungerar utan den.", "Your position (OwnTracks)": "Din position (OwnTracks)", "Share from the map instead": "Dela från kartan i stället",
    "We share positions with the OwnTracks app. It keeps sending with the phone locked in your pocket, and your dot shows on everyone's map. Set it up once:":
      "Vi delar positioner med appen OwnTracks. Den fortsätter skicka med telefonen låst i fickan, och din prick syns på allas karta. Ställ in den en gång:",
    "Only for a phone without OwnTracks: it sends only while the map is open on screen. Don't turn it on on a computer.":
      "Bara för en telefon utan OwnTracks: den skickar bara medan kartan är öppen på skärmen. Slå inte på den på en dator.",
    "Your own address with your personal code. Don't share it.": "Din egen adress med din personliga kod. Dela den inte.",
    "In OwnTracks, tap Settings:": "I OwnTracks, tryck på Settings:", "paste your address": "klistra in din adress", "off": "av",
    "Further down in Settings, under Expert Mode:": "Längre ner i Settings, under Expert Mode:",
    "Settings → Remote Control: turn on": "Settings → Remote Control: slå på", "and": "och",
    "Then OwnTracks switches between Move and battery-saving by itself.": "Då växlar OwnTracks själv mellan Move och batterisparläge.",
    "iPhone settings → OwnTracks → Location:": "iPhone-inställningar → OwnTracks → Plats:", "Always": "Alltid",
    "and Precise Location on. Also: General → Background App Refresh → OwnTracks on.": "och Exakt plats på. Även: Allmänt → Uppdatera i bakgrunden → OwnTracks på.",
    "Within a minute the line above turns green. Done.": "Inom en minut blir raden ovanför grön. Klart.", "Every hunt": "Varje jakt",
    "When you leave for the hunt: set OwnTracks to": "När du åker till jakten: ställ OwnTracks på",
    "It switches to": "Den växlar till", "by itself at the hunting ground or when a hunt day starts.": "själv vid jaktmarken eller när en jaktdag startar.",
    "When you're home again: set it to": "När du är hemma igen: ställ den på",
    "(nothing is shared). Switch at home, not at the hunting ground, or you'll look like you're still there.": "(inget delas). Byt hemma, inte vid jaktmarken, annars ser det ut som att du är kvar där.",
    "Don't swipe OwnTracks away, and avoid Low Power Mode during the hunt.": "Svep inte bort OwnTracks, och undvik strömsparläge under jakten.", "Last position from your OwnTracks:": "Senast mottaget från din OwnTracks:", "Nothing has arrived from your OwnTracks yet.": "Inget har kommit från din OwnTracks än.", 
    "Set up the receiver and the forwarder once (see tools/owntracks/SETUP.md), then paste the forwarder address here.": "Sätt upp mottagaren och vidarebefordraren en gång (se tools/owntracks/SETUP.md) och klistra sedan in vidarebefordrarens adress här.",
    "The map owner needs to set up the receiver first.": "Kartans ägare behöver sätta upp mottagaren först.",
    "Install": "Installera", "from the App Store (free).": "från App Store (gratis).", 
    
    "Copy my address": "Kopiera min adress", "Change receiver address": "Ändra mottagarens adress", "Making your personal code…": "Skapar din personliga kod…",
    "Paste the forwarder address, the one ending in workers.dev.": "Klistra in vidarebefordrarens adress, den som slutar på workers.dev.", "Copied": "Kopierat", 
    "Waiting for GPS…": "Väntar på GPS…",
    "Game trails": "Viltstigar", "model": "modell", 
    "Most likely trails": "Troligaste viltstigar", "Other likely trails": "Andra möjliga viltstigar", "Bedding cover": "Liggplatser, skydd", "Feeding": "Bete",
    "Modelled from terrain, forest and roads, not from observations. Compare with your sightings.": "Beräknat från terräng, skog och vägar, inte från observationer. Jämför med era obs.", "Start hunt day": "Starta jaktdag", "Hunt day": "Jaktdag", "Hunt day in progress": "Jaktdag pågår",
    "Since": "Sedan", "leader": "jaktledare", "End the hunt day": "Avsluta jaktdagen", "Tap again to end": "Tryck igen för att avsluta", "Earlier hunt days": "Tidigare jaktdagar",
    "Start a hunt day to give everyone a stand. Given stands count for the shooting-sector warning right away.": "Starta en jaktdag och ge alla ett pass. Utdelade pass räknas direkt i skjutsektorvarningen.",
    "Shot": "Skott", "shots": "skott", "down": "fällda", "Wind": "Vind", 
    
    "Best stands": "Bästa passen", "Now": "Nu", "Tomorrow morning": "I morgon bitti", "Tomorrow evening": "I morgon kväll",
    "No stand has good wind then.": "Inget pass har bra vind då.", "Record my track": "Spela in mitt spår", "Blood tracking (eftersök)": "Eftersök",
    "Blood": "Blod", "Tracks": "Spår", "Bed": "Bädd", "Hair": "Hår", "Animal found": "Djuret hittat", "Stop": "Stoppa", "Recorded tracks": "Inspelade spår",
    "No recorded tracks yet. Start one with +.": "Inga inspelade spår än. Starta med +.", "Start blood tracking here": "Starta eftersök härifrån", "Already recording.": "Spelar redan in.",
    "Blood tracking started. Mark what you find as you go.": "Eftersök startat. Markera det du hittar längs vägen.", "Recording your track. You can lock the phone; OwnTracks fills in the gaps.": "Spelar in ditt spår. Du kan låsa telefonen; OwnTracks fyller i luckorna.", 
    "Track": "Spår", "Blood tracking": "Eftersök", "Recording": "Spelar in", "live": "pågår", "· live": "· pågår", "Back online.": "Uppkopplad igen.",
    "No coverage. The map still works; positions and messages are sent when you're back online.": "Ingen täckning. Kartan fungerar ändå; positioner och meddelanden skickas när du har täckning igen.", "Seasons": "Jakttid", "No stands yet. Add one with +.": "Inga pass än. Lägg till med +.", "No stalk routes yet.": "Inga smygrutter än.", "Message the team": "Meddela laget", "On my stand": "På pass", "Leaving my stand": "Lämnar passet",
    "Shot fired": "Skott", "Need help!": "Behöver hjälp!", "Tap the map where the animal is": "Tryck på kartan där djuret är", "Heard a sound": "Hörde ljud", "Route": "Väg", "Choose stand": "Välj pass", "Placed on the map": "Placerat på kartan", "Place on the map…": "Placera på kartan…", "Place stand": "Placera pass", "Move": "Flytta",
    "No route yet": "Ingen väg än", "No stand yet": "Inget pass än", "Chosen start": "Vald startpunkt", "Tap the start on the map…": "Välj start på kartan…",
    "Via a road or track…": "Via en väg eller stig…", "Via the chosen road": "Via vald väg",
    "Tap the map where they will sit": "Tryck på kartan där personen ska sitta", "Tap the road, track or spot they will walk via": "Tryck på vägen, stigen eller platsen personen ska gå via",
    "Tap where they start walking": "Tryck där personen börjar gå", "Stands from last time are filled in. Change what differs today.": "Passen från förra gången är ifyllda. Ändra det som skiljer i dag.", "Change route": "Ändra väg", "From": "Från", "No route": "Ingen väg", "Close": "Stäng",
    "Easiest": "Lättast", "Quietest": "Tystast", "Scent-safe": "Vindsäker", "Another way": "Annan väg",
    "Add a place first (e.g. Parkering) to start the walk from.": "Lägg först till en plats (t.ex. Parkering) att gå från.",
    "Couldn't find a way there from that start.": "Hittade ingen väg dit från den starten.", "Thermals now: cold air is running downhill and along the hollows. Scent follows it down.": "Termik nu: kalluften rinner nedför och längs sänkorna. Vittringen följer med nedåt.",
    "Thermals now: the sun warms the slopes and the air rises uphill. Scent drifts up.": "Termik nu: solen värmer sluttningarna och luften stiger uppför. Vittringen driver uppåt.",
    "Thermals now: hardly any (too windy, cloudy or the air is turning).": "Termik nu: knappt märkbar (för blåsigt, molnigt eller luften vänder).", "Tap roughly where the sound came from": "Tryck ungefär där ljudet kom ifrån", "Started the hunt day": "Startade jaktdagen", "The hunt is over": "Jakten är slut", "Animal down": "Djur skjutet", "Need help": "Behöver hjälp", "Today's messages": "Dagens meddelanden", "No messages today.": "Inga meddelanden i dag.",
    "Waiting for your position. Try again in a moment.": "Väntar på din position. Försök igen om en stund.", "No stand within 150 m of you.": "Inget pass inom 150 m från dig.",
    "Couldn't send. The owner needs to publish the new Firebase rules.": "Kunde inte skicka. Ägaren behöver publicera de nya Firebase-reglerna.", "Letter on the map": "Bokstav på kartan", "Name on the map": "Namn på kartan", "Colour": "Färg", "Wind lines in the terrain": "Vindlinjer i terrängen", "in 3D": "i 3D", "Position not working?": "Fungerar inte positionen?",
    "Still no GPS position. If no question about location appeared, location is blocked for Safari. See Family → Position not working?":
      "Ingen GPS-position än. Om ingen fråga om plats dök upp är platsen blockerad för Safari. Se Familj → Fungerar inte positionen?",
    "Location is blocked for this site. See Family → Position not working?": "Platsen är blockerad för den här sidan. Se Familj → Fungerar inte positionen?",
    "1. iPhone settings:": "1. iPhone-inställningar:", "2. Safari, for this site:": "2. Safari, för den här sidan:", "3. Close and open again:": "3. Stäng och öppna igen:",
    "Settings → Privacy & Security → Location Services: on. Scroll down to Safari Websites → While Using the App, and turn on Precise Location.":
      "Inställningar → Integritetsskydd och säkerhet → Platstjänster: på. Scrolla ner till Safari-webbplatser → När appen används, och slå på Exakt plats.",
    "tap aA (or the icon left of the address) → Website Settings → Location → Allow.": "tryck på aA (eller ikonen till vänster om adressen) → Webbplatsinställningar → Plats → Tillåt.",
    "swipe the app or Safari away and open the map again, then tap the position button. Answer Allow when it asks about location.":
      "svep bort appen eller Safari och öppna kartan igen, tryck sedan på positionsknappen. Svara Tillåt när den frågar om plats.",
    "The compass is asked for on the next tap on the map, after the position works.": "Kompassen frågas efter vid nästa tryck på kartan, när positionen fungerar.", "Scent from me": "Vittring från mig", "Scent from stands": "Vittring från passen",
    "In light wind scent sinks downhill and along hollows in the evening and at night, and rises uphill in the middle of the day.": "I svag vind sjunker vittringen nedför och längs sänkorna på kvällen och natten, och stiger uppför mitt på dagen.",
    "Clear": "Klart", "Nearly clear": "Nästan klart", "Variable cloud": "Växlande molnighet", "Half clear": "Halvklart", "Cloudy": "Molnigt", "Overcast": "Mulet",
    "Fog": "Dimma", "Light rain showers": "Lätta regnskurar", "Rain showers": "Regnskurar", "Heavy rain showers": "Kraftiga regnskurar", "Thunderstorm": "Åskväder",
    "Light sleet showers": "Lätta byar av snöblandat regn", "Sleet showers": "Byar av snöblandat regn", "Heavy sleet showers": "Kraftiga byar av snöblandat regn",
    "Light snow showers": "Lätta snöbyar", "Snow showers": "Snöbyar", "Heavy snow showers": "Kraftiga snöbyar", "Light rain": "Lätt regn", "Rain": "Regn",
    "Heavy rain": "Kraftigt regn", "Thunder": "Åska", "Light sleet": "Lätt snöblandat regn", "Sleet": "Snöblandat regn", "Heavy sleet": "Kraftigt snöblandat regn",
    "Light snow": "Lätt snöfall", "Snow": "Snöfall", "Heavy snow": "Kraftigt snöfall", "Whose plans to show": "Vems planer som visas",
    "Stands, stalk routes and sightings. Only changes what you see on this phone.": "Pass, smygrutter och observationer. Ändrar bara vad du ser på din telefon.",
    "Made before names were saved": "Gjort innan namn sparades", "(you)": "(du)", "Unknown": "Okänd", "Follow me (the map turns with you)": "Följ mig (kartan vrids med dig)",
    "Turn off my position": "Stäng av min position", "Follow me": "Följ mig", "My scent": "Vittring", "Show my scent cone": "Visa min vittringskon",
    
    // compass letters
    ...COMPASS, ...DAYS,
  };
  // phrases with numbers or names inside
  const RULES = [
    [/^(.+) on wet ground$/, (m, a) => `${tr(a)} på våtmark`],
    [/^faces ([A-Z]{1,3})$/, (m, a) => `mot ${C(a)}`],
    [/^([A-Z]{1,3}) · (\d+)°$/, (m, a, b) => `${C(a)} · ${b}°`],
    [/^From (\d+)° at ([\d.]+) m\/s(?:, gusts (\d+))?$/, (m, a, b, g) => `Från ${a}° i ${b} m/s` + (g ? `, byar ${g}` : "")],
    [/^visibility ([\d.]+ k?m)$/, (m, a) => `sikt ${a}`],
    [/^Sunrise ([\d:]+)$/, (m, a) => `Soluppgång ${a}`],
    [/^Sunset ([\d:]+)$/, (m, a) => `Solnedgång ${a}`],
    [/^(.+) is on stand (.*)$/, (m, a, b) => `${a} är på pass ${b}`.trim()],
    [/^(.+) left the stand$/, (m, a) => `${a} lämnade passet`],
    [/^(.+): shot fired toward ([A-Z]{1,3})$/, (m, a, b) => `${a}: skott mot ${C(b)}`],
    [/^(.+): shot fired$/, (m, a) => `${a}: skott`],
    [/^(.+): animal down$/, (m, a) => `${a}: djur skjutet`],
    [/^(.+): animal near me toward ([A-Z]{1,3})$/, (m, a, b) => `${a}: djur nära mig, mot ${C(b)}`],
    [/^(.+): animal near me$/, (m, a) => `${a}: djur nära mig`],
    [/^(.+) needs help$/, (m, a) => `${a} behöver hjälp`],
    [/^(.+) is in your shooting sector$/, (m, a) => `⚠ ${a} är i din skjutsektor`],
    [/^You're in (.+)'s shooting sector$/, (m, a) => `⚠ Du är i ${/[sxz]$/i.test(a) ? a : a + "s"} skjutsektor`],
    [/^(\d+)% visible$/, (m, a) => `${a} % syns`],
    [/^(\d+)% behind terrain$/, (m, a) => `${a} % bakom terräng`],
    [/^(\d+)% thick forest$/, (m, a) => `${a} % tät skog`],
    [/^Saved: (.+)$/, (m, a) => `Sparat: ${a}`],
    [/^(\d+) marks$/, (m, a) => `${a} markeringar`],
    [/^(.+) ✓$/, (m, a) => `${tr(a)} ✓`],
    [/^(\d+) seen in similar wind$/, (m, a) => `${a} obs i liknande vind`],
    [/^(\d+) seen here$/, (m, a) => `${a} obs här`],
    [/^([A-Z]{1,3}) (\d+)°$/, (m, a, b) => `${C(a)} ${b}°`],
    [/^(.+) started the hunt day$/, (m, a) => `${a} startade jaktdagen`],
    [/^(.+): the hunt is over$/, (m, a) => `${a}: jakten är slut`],
    [/^Your stand today: (.+)$/, (m, a) => `Ditt pass i dag: ${a}`],
    [/^Your stand: (.+)$/, (m, a) => `Ditt pass: ${a}`],
    [/^Last position (\d+) min ago$/, (m, a) => `Senaste position för ${a} min sedan`],
    [/^You · OwnTracks · (.+)$/, (m, a) => `Du · OwnTracks · ${tr(a)}`],
    [/^\((.+)\)$/, (m, a) => `(${tr(a)})`],
    [/^Still for (\d+) min$/, (m, a) => `Står still sedan ${a} min`],
    [/^(.+)'s phone battery is low \((\d+)%\)$/, (m, a, b) => `${/[sxz]$/i.test(a) ? a : a + "s"} telefon har lite batteri (${b} %)`],
    [/^gusts (\d+)$/, (m, a) => `byar ${a}`],
    [/^([\d.]+) mm in 24 h$/, (m, a) => `${a.replace(".", ",")} mm regn senaste dygnet`],
    [/^Shot fired toward ([A-Z]{1,3})$/, (m, a) => `Skott mot ${C(a)}`],
    [/^Animal (\d+) m ([A-Z]{1,3}) of me$/, (m, a, b) => `Djur ${a} m ${C(b)} om mig`],
    [/^Where (.+) is now$/, (m, a) => `Där ${a} är nu`],
    [/^(.+)'s stand$/, (m, a) => `${/[sxz]$/i.test(a) ? a : a + "s"} pass`],
    [/^Route saved for (.+)$/, (m, a) => `Väg sparad för ${a}`],
    [/^Walks from (.+), (\d+) m$/, (m, a, b) => `Går från ${a}, ${b} m`],
    [/^Tap the way (.+) says they will walk\. The lines are on the map\.$/, (m, a) => `Tryck på den väg ${a} tänker gå. Linjerna syns på kartan.`],
    [/^Heard a sound (\d+) m ([A-Z]{1,3}) of me$/, (m, a, b) => `Hörde ljud ${a} m ${C(b)} om mig`],
    [/^(.+): heard a sound (\d+) m ([A-Z]{1,3}) of me$/, (m, a, b, c) => `${a}: hörde ljud ${b} m ${C(c)} om mig`],
    [/^(.+): heard a sound$/, (m, a) => `${a}: hörde ljud`],
    [/^(.+): animal (\d+) m ([A-Z]{1,3}) of me$/, (m, a, b, c) => `${a}: djur ${b} m ${C(c)} om mig`],
    [/^Animal near me toward ([A-Z]{1,3})$/, (m, a) => `Djur nära mig, mot ${C(a)}`],
    [/^at (.+)$/, (m, a) => `vid ${a}`],
    [/^(\d+) m ([A-Z]{1,3}) of you$/, (m, a, b) => `${a} m ${C(b)} om dig`],
    [/^([\d.]+) km ([A-Z]{1,3}) of you$/, (m, a, b) => `${a.replace(".", ",")} km ${C(b)} om dig`],
    [/^Copied (.+)'s coordinates$/, (m, a) => `${/[sxz]$/i.test(a) ? a : a + "s"} koordinater kopierade`],
    [/^Position from (.+) ago$/, (m, a) => `Positionen är ${a.replace(" h", " tim")} gammal`],
    [/^Scent drifts toward ([A-Z]{1,3})$/, (m, a) => `Vittringen driver mot ${C(a)}`],
    [/^([A-Z]{1,3}) ([\d.]+) m\/s( \(\d+\))?\.?$/, (m, a, b, g) => `${C(a)} ${b} m/s${g || ""}`],
    [/^Facing ([A-Z]{1,3}) (\d+)°$/, (m, a, b) => `Du tittar mot ${C(a)} ${b}°`],
    [/^Your scent carries about (\d+) m toward ([A-Z]{1,3})\.$/, (m, a, b) => `Din vittring bär cirka ${a} m mot ${C(b)}.`],
    [/^Hunting boundary: ([\d.]+) ha, (\d+) points\.$/, (m, a, b) => `Jaktgräns: ${a} ha, ${b} punkter.`],
    [/^(\d+) corners$/, (m, a) => `${a} hörn`],
    [/^bearing (\d+)°$/, (m, a) => `bäring ${a}°`],
    [/^Stalk route (\d+)$/, (m, a) => `Smygrutt ${a}`],
    [/^Stand (\d+)$/, (m, a) => `Pass ${a}`],
    [/^Boundary saved: ([\d.]+) ha$/, (m, a) => `Gränsen sparad: ${a} ha`],
    [/^Saved with the wind you have set: ([A-Z]{1,3}) ([\d.]+) m\/s\.$/, (m, a, b) => `Sparas med vinden du har ställt in: ${C(a)} ${b} m/s.`],
    [/^Wind at the time: (.+)$/, (m, a) => `Vind vid tillfället: ${tr(a)}`],
    [/^wind (.+)$/, (m, a) => `vind ${tr(a)}`],
    [/^What you can see from (.+)$/, (m, a) => `Det här ser du från ${a === "the stand" ? "passet" : a}`],
    [/^In the shooting sector: (\d+)% visible, (\d+)% dead ground, (\d+)% hidden by thick forest\. (\d+)% of the visible ground has a natural backstop within 50 m\.$/,
      (m, a, b, c, d) => `I skjutsektorn: ${a} % syns, ${b} % dolt bakom terräng, ${c} % dolt av tät skog. ${d} % av det som syns har naturligt kulfång inom 50 m.`],
    [/^Felled recently \(about (\d+) m trees around 2019\)$/, (m, a) => `Nyligen avverkat (cirka ${a} m höga träd runt 2019)`],
    [/^about (\d+) m tall$/, (m, a) => `cirka ${a} m höga`],
    [/^(.+), (\d+) m ([A-Z]{1,3})$/, (m, a, b, c) => `${tr(a)}, ${b} m ${C(c)}`],
    [/^(\d+) m ([A-Z]{1,3})$/, (m, a, b) => `${a} m ${C(b)}`],
    [/^You're ([\d.]+) km from the hunting ground\. Your dot shows on the map once you're near it\.$/, (m, a) => `Du är ${a} km från jaktmarken. Din prick visas på kartan när du är nära.`],
    [/^You're outside the detailed map areas \(([\d.]+) km away\), so only the terrain shows here\.$/, (m, a) => `Du är utanför de detaljerade kartområdena (${a} km bort), så här visas bara terrängen.`],
    [/^(\d+) min ago$/, (m, a) => `${a} min sedan`],
    [/^(\d+) h ago$/, (m, a) => `${a} tim sedan`],
    [/^(\d+) min$/, (m, a) => `${a} min`],
    [/^Last seen (.*)$/, (m, a) => `Senast sedd ${tr(a)}`.trim()],
    [/^Signed in as (.+)\.$/, (m, a) => `Inloggad som ${a}.`],
    [/^(.+) can now sign in with (.+)\.$/, (m, a, b) => `${a} kan nu logga in med ${b}.`],
    [/^Imported (\d+) items\.$/, (m, a) => `Importerade ${a} objekt.`],
    [/^If (.+) has an account, a reset link is on its way\.$/, (m, a) => `Om ${a} har ett konto är en återställningslänk på väg.`],
    [/^Offline: showing the forecast from (.+) ago\. (.*)$/, (m, a, b) => `Offline: visar prognosen från för ${a.replace(" h", " tim")} sedan. ${tr(b)}`],
    [/^SMHI forecast$/, () => "SMHI-prognos"],
    [/^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d:\d\d)$/, (m, a, b) => `${DAYS[a]} ${b}`],
    [/^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d:\d\d), wind from ([A-Z]{1,3}) ([\d.]+) metres per second$/, (m, a, b, c, d) => `${DAYS[a]} ${b}, vind från ${C(c)} ${d} meter per sekund`],
    [/^(\d+)% into the wind now$/, (m, a) => `${a} % mot vinden just nu`],
    [/^(.+) ×(\d+)$/, (m, a, b) => `${tr(a)} ×${b}`],
    [/^Drag points to adjust\. Zoom in to drag the small dots and add points\. (.+)$/, (m, a) => `Dra punkterna för att justera. Zooma in för att dra de små prickarna och lägga till punkter. ${a}`],
    [/^(.+) \((?:älg|rådjur|dovhjort|kronhjort|vildsvin|räv|fågel|annat)\)$/, (m, a) => tr(a)],
  ];

  function tr(text) {
    if (lang !== "sv" || !text) return text;
    const t = text.trim();
    if (!t) return text;
    const lead = text.slice(0, text.indexOf(t)), tail = text.slice(text.indexOf(t) + t.length);
    return lead + trCore(t) + tail;
  }
  function trCore(t) {
    if (Object.prototype.hasOwnProperty.call(SV, t)) return SV[t];
    for (const [re, fn] of RULES) { const m = t.match(re); if (m) return fn(...m); }
    if (t.includes(" · ")) return t.split(" · ").map((p) => (Object.prototype.hasOwnProperty.call(SV, p) ? SV[p] : trSeg(p))).join(" · ");
    return t;
  }
  function trSeg(p) {
    for (const [re, fn] of RULES) { const m = p.match(re); if (m) return fn(...m); }
    return p;
  }

  const ATTRS = ["title", "placeholder", "aria-label"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
  function translateNode(node) {
    if (node.nodeType === 3) {
      const p = node.parentNode;
      if (p && !SKIP.has(p.nodeName) && !(p.closest && p.closest("[translate=no]"))) {
        const v = tr(node.nodeValue);
        if (v !== node.nodeValue) node.nodeValue = v;
      }
      return;
    }
    if (node.nodeType !== 1 || node.nodeName === "SCRIPT" || node.nodeName === "STYLE" || node.getAttribute("translate") === "no") return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v) { const t = tr(v); if (t !== v) node.setAttribute(a, t); }
    }
    if (SKIP.has(node.nodeName)) return;  // never touch what people type, only the hints on the fields
    for (const c of node.childNodes) translateNode(c);
  }
  function start() {
    if (lang !== "sv") return;
    document.documentElement.lang = "sv";
    document.title = tr(document.title);
    translateNode(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") translateNode(m.target);
        else if (m.type === "attributes") translateNode(m.target.cloneNode ? m.target : m.target);
        else for (const n of m.addedNodes) translateNode(n);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  root.I18N = { lang, tr, compass: C };
})(typeof window !== "undefined" ? window : globalThis);
