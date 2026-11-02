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
    "Drainage & cold-air flow": "Avrinning och kalluftsflöde", "Steep ground": "Brant terräng", "3D view": "3D-vy", "Tilt into 3D": "Luta till 3D",
    "Height exaggeration": "Höjdförstärkning", "Boundary": "Jaktgräns",
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
    "Scent cone from my position": "Vittringskon från min position", "Scent cones from stands": "Vittringskoner från passen",
    "Each cone shows where scent from a stand is likely to carry. Light wind swirls, so cones get wider and shorter.":
      "Varje kon visar vart vittringen från ett pass troligen bär. Svag vind virvlar, så konerna blir bredare och kortare.",
    "Stands in this wind": "Passen i den här vinden", "Thermals": "Termik",
    "In calm mornings air warms and drifts uphill. In the evening it cools and slides downhill along hollows. Turn on":
      "Lugna morgnar värms luften och driver uppför. På kvällen svalnar den och rinner nedför längs sänkor. Slå på",
    "to see which way scent pools at dusk.": "för att se vart vittringen samlas i skymningen.",
    "Set by hand": "Inställd för hand", "The SMHI forecast can't be loaded here. Set the wind with the dial.": "SMHI-prognosen kan inte hämtas här. Ställ in vinden med ratten.",
    "Big number: wind in m/s, small: gusts. Tap an hour to plan for it. Wind in the forest is weaker and less steady than the forecast.":
      "Stor siffra: vind i m/s, liten: byar. Tryck på en timme för att planera för den. I skogen är vinden svagare och ostadigare än prognosen.",
    "Calm: scent pools and swirls": "Stiltje: vittringen samlas och virvlar", "Turn on your position to see it.": "Slå på din position för att se den.",
    "Calm: your scent spreads about 60 m around you and drifts with the slope.": "Stiltje: din vittring sprids cirka 60 m runt dig och följer sluttningen.",
    "Place stands to see which ones work in this wind.": "Placera pass för att se vilka som fungerar i den här vinden.",
    "Calm": "Stiltje",
    // stands
    "Place a stand": "Placera pass", "Plan stalk route": "Planera smygrutt", "Stand": "Pass", "New stand": "Nytt pass", "Edit stand": "Ändra pass",
    "e.g. Tornet vid hygget": "t.ex. Tornet vid hygget", "Tower / high seat": "Torn", "Ladder stand": "Stege", "Ground blind": "Markpass", "Drive post (pass)": "Drevpass",
    "Drive post": "Drevpass", "Seat height (m)": "Sitthöjd (m)", "Facing": "Riktning", "Shooting sector": "Skjutsektor", "Max shooting distance": "Max skjutavstånd",
    "Show what I can see from here": "Visa vad jag ser härifrån", "Looking for": "Letar efter", "roe deer, boar": "rådjur, vildsvin", "fallow, red deer": "dovhjort, kronhjort",
    "moose": "älg", "No colour: you can see it, a miss hits the ground": "Ingen färg: syns, en bom tas av marken",
    "Yellow stripes: you can see it, but a miss flies on": "Gula ränder: syns, men en bom flyger vidare",
    "Purple stripes: hidden behind a hill or in a hollow": "Lila ränder: dolt bakom en höjd eller i en sänka", "Dark: hidden by thick forest": "Mörkt: dolt av tät skog",
    "Working out the view…": "Räknar ut sikten…", "No ground inside the shooting sector.": "Ingen mark inom skjutsektorn.",
    "Works in wind from": "Fungerar i vind från", "(optional, overrides the automatic check)": "(valfritt, ersätter den automatiska kontrollen)", "Notes": "Anteckningar",
    "Approach from the track, sit before 16:00…": "Gå in från traktorvägen, sitt på plats före 16:00…", "Save stand": "Spara pass",
    "Drag the stand on the map to move it.": "Dra passet på kartan för att flytta det.", "Stalk routes": "Smygrutter", "Stalk route": "Smygrutt",
    "Its wind": "Rätt vind", "Not its wind": "Fel vind", "Calm, swirling": "Stiltje, virvlar", "Scent into sector": "Vittring i sektorn", "Side wind": "Sidvind", "Good wind": "Bra vind",
    "Unnamed stand": "Namnlöst pass", "No stands yet. Tap": "Inga pass än. Tryck på", ", then tap the map where it is.": " och tryck sedan på kartan där det står.",
    "Draw a stalking route to check each leg against the wind. Green legs head into the wind.": "Rita en smygrutt för att kontrollera varje sträcka mot vinden. Gröna sträckor går mot vinden.",
    "Stand saved": "Passet sparat", "Stand updated": "Passet uppdaterat", "Route saved. Its colours follow the wind you set.": "Rutten sparad. Färgerna följer vinden du ställt in.",
    "Confirm": "Bekräfta",
    // sightings
    "Log a sighting": "Logga observation", "Filter sightings by species": "Filtrera observationer per art", "Sighting": "Observation", "Species": "Art", "Count": "Antal",
    "When": "När", "What": "Vad", "Seen": "Sett", "Shot": "Skjuten", "Tracks / sign": "Spår / tecken", "Bed / daybed": "Liga / dagliga", "Rub / wallow": "Fejning / gyttjebad",
    "Cow with calf heading north along the ditch": "Ko med kalv på väg norrut längs diket", "Save sighting": "Spara observation", "Sighting saved": "Observationen sparad",
    "Export": "Exportera", "Save stands, routes, boundary and sightings as a file you can import into a GPS hunting app.":
      "Spara pass, rutter, gräns och observationer som en fil du kan importera i en GPS-jaktapp.", "Export GPX": "Exportera GPX", "Export GeoJSON": "Exportera GeoJSON",
    "All species": "Alla arter", "Moose": "Älg", "Roe deer": "Rådjur", "Fallow deer": "Dovhjort", "Red deer": "Kronhjort", "Wild boar": "Vildsvin", "Fox": "Räv", "Bird": "Fågel",
    "Other": "Annat", "Moose (älg)": "Älg", "Roe deer (rådjur)": "Rådjur", "Fallow deer (dovhjort)": "Dovhjort", "Red deer (kronhjort)": "Kronhjort",
    "Wild boar (vildsvin)": "Vildsvin", "Fox (räv)": "Räv", "Bird (fågel)": "Fågel", "Other (annat)": "Annat",
    "No sightings of this species yet.": "Inga observationer av den här arten än.",
    "No sightings yet. Log what you see, where and in which wind, and patterns show up over a season.": "Inga observationer än. Logga vad du ser, var och i vilken vind, så syns mönster över säsongen.",
    "Saved as .txt. Rename it to .gpx before importing.": "Sparad som .txt. Byt filändelse till .gpx innan du importerar.", "The file couldn't be saved here.": "Filen kunde inte sparas här.",
    // family
    "Share my position": "Dela min position", "Off. Your family can't see you.": "Av. Familjen kan inte se dig.",
    "Positions only update while the map is open. On iPhone, set Auto-Lock to Never during the hunt.": "Positionen uppdateras bara medan kartan är öppen. På iPhone: sätt Automatiskt lås till Aldrig under jakten.",
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
    "Map of the hunting ground": "Karta över jaktmarken", "Map tools": "Kartverktyg", "Plan a stalk route": "Planera en smygrutt", "Measure distance": "Mät avstånd",
    "Draw hunting boundary": "Rita jaktgräns", "Show my position": "Visa min position", "Toggle 3D": "Växla 3D", "Back to the hunting ground": "Tillbaka till jaktmarken",
    "Add trail": "Lägg till stig", "Add place": "Lägg till plats", "Undo": "Ångra", "Delete point": "Ta bort punkt", "Finish": "Klar", "Cancel": "Avbryt", "Done": "Klar", "Clear": "Rensa",
    "Tap to turn the map north up": "Tryck för att vrida kartan med norr uppåt", "Compass. Tap to turn the map north up": "Kompass. Tryck för att vrida kartan med norr uppåt",
    "Open the wind tab": "Öppna vindfliken", "Show my facing": "Visa min riktning", "Hide facing": "Dölj riktning", "What you can see from the stand": "Det här ser du från passet",
    "Loading terrain…": "Laddar terräng…", "Tap the map where the stand is": "Tryck på kartan där passet står", "Tap where you saw it": "Tryck där du såg det",
    "Tap to add points along your stalk": "Tryck för att lägga till punkter längs smygrutten", "Tap points to measure": "Tryck ut punkter för att mäta",
    "Tap the corners of your hunting area": "Tryck ut hörnen på jaktmarken", "Tap points along the new trail": "Tryck ut punkter längs den nya stigen",
    "Tap where the name should go": "Tryck där namnet ska stå", "Drag a name to move it, tap it to rename. Tap a trail to reshape it.": "Dra ett namn för att flytta det, tryck för att byta namn. Tryck på en stig för att ändra den.",
    "Trail saved": "Stigen sparad", "Trail added. Give it a name if you like.": "Stigen tillagd. Ge den ett namn om du vill.", "New place": "Ny plats",
    "Drag the name on the map to move it.": "Dra namnet på kartan för att flytta det.", "Drag the points on the map to reshape it, then Save.": "Dra punkterna på kartan för att ändra den och tryck sedan på Spara.",
    "Place saved": "Platsen sparad", "Tap again to delete": "Tryck igen för att ta bort", "Place deleted": "Platsen borttagen", "Trail deleted": "Stigen borttagen",
    "This browser can't share your position.": "Den här webbläsaren kan inte dela din position.",
    "Location is blocked. On iPhone: Settings → Privacy → Location Services → Safari Websites → While Using.": "Platsåtkomst är blockerad. På iPhone: Inställningar → Integritet → Platstjänster → Safari-webbplatser → När appen används.",
    "Your position isn't available here. On a phone, open the map from its web address and allow location.": "Din position är inte tillgänglig här. Öppna kartan från webbadressen på telefonen och tillåt plats.",
    "This device has no compass.": "Den här enheten har ingen kompass.", "Compass access was refused. Close the app and open it again to be asked again.": "Kompassen nekades. Stäng appen och öppna den igen för att få frågan igen.",
    "Couldn't save. Check your connection.": "Kunde inte spara. Kontrollera anslutningen.", "Storage is full. Delete old sightings to make room.": "Lagringen är full. Ta bort gamla observationer.",
    "Couldn't save. Check your connection and try again.": "Kunde inte spara. Kontrollera anslutningen och försök igen.", "Couldn't delete. Try again.": "Kunde inte ta bort. Försök igen.",
    "Couldn't save the boundary. Try again.": "Kunde inte spara gränsen. Försök igen.", "Map data didn't load. Reload the page.": "Kartdata laddades inte. Ladda om sidan.",
    "Roads didn't load.": "Vägarna laddades inte.", "Contours didn't load.": "Höjdkurvorna laddades inte.",
    // tap-to-inspect popup
    "Elevation": "Höjd", "Slope": "Lutning", "Trees": "Träd", "Moisture": "Fuktighet", "Nearest stand": "Närmaste pass", "Open, under 2 m": "Öppet, under 2 m",
    "Dry": "Torrt", "Fresh": "Friskt", "Moist": "Fuktigt", "Wet": "Blött", "Open at Lantmäteriet ↗": "Öppna hos Lantmäteriet ↗",
    "(Flygbild in its layer menu shows aerial photos, 1960 and 1975 too)": "(Flygbild i lagermenyn visar flygfoton, även från 1960 och 1975)",
    "just now": "nyss", "Map marker": "Kartmarkör", "App version:": "Appversion:", "Log": "Obs", "Edit the map": "Redigera kartan", "Settings": "Inställningar", "Screen": "Skärm",
    "Night mode (dimmed screen)": "Nattläge (dämpad skärm)", "3D height exaggeration": "Höjdförstärkning i 3D", "3D terrain": "3D-terräng", "Adjust by hand": "Ställ in för hand",
    "Add or draw": "Lägg till eller rita", "View in 3D": "Visa i 3D", "3D view here": "3D-vy här", "Where you are": "Där du står", "Map centre": "Kartans mitt",
    "Eye height": "Ögonhöjd", "Turn with phone": "Vrid med telefonen", "Building the 3D view…": "Bygger 3D-vyn…", "3D view works inside the map areas.": "3D-vyn fungerar inom kartområdena.",
    "The 3D view couldn't load. Check your connection.": "3D-vyn kunde inte laddas. Kontrollera uppkopplingen.",
    "Trees from satellite data about 2018–2020, felled areas shown as regrowth. Deciduous trees are bare in winter.": "Träd från satellitdata cirka 2018–2020, avverkat visas som återväxt. Lövträd är kala på vintern.", "Best stands": "Bästa passen", "Now": "Nu", "Tomorrow morning": "I morgon bitti", "Tomorrow evening": "I morgon kväll",
    "No stand has good wind then.": "Inget pass har bra vind då.", "Record my track": "Spela in mitt spår", "Blood tracking (eftersök)": "Eftersök",
    "Blood": "Blod", "Tracks": "Spår", "Bed": "Bädd", "Hair": "Hår", "Animal found": "Djuret hittat", "Stop": "Stoppa", "Recorded tracks": "Inspelade spår",
    "No recorded tracks yet. Start one with +.": "Inga inspelade spår än. Starta med +.", "Start blood tracking here": "Starta eftersök härifrån", "Already recording.": "Spelar redan in.",
    "Blood tracking started. Mark what you find as you go.": "Eftersök startat. Markera det du hittar längs vägen.", "Recording your track. Keep the screen on.": "Spelar in ditt spår. Håll skärmen tänd.",
    "Track": "Spår", "Blood tracking": "Eftersök", "Recording": "Spelar in", "live": "pågår", "· live": "· pågår", "Back online.": "Uppkopplad igen.",
    "No coverage. The map still works; positions and messages are sent when you're back online.": "Ingen täckning. Kartan fungerar ändå; positioner och meddelanden skickas när du har täckning igen.", "Seasons": "Jakttid", "No stands yet. Add one with +.": "Inga pass än. Lägg till med +.", "No stalk routes yet.": "Inga smygrutter än.", "Message the team": "Meddela laget", "On my stand": "På pass", "Leaving my stand": "Lämnar passet",
    "Shot fired": "Skott", "Animal down": "Djur skjutet", "Need help": "Behöver hjälp", "Today's messages": "Dagens meddelanden", "No messages today.": "Inga meddelanden i dag.",
    "Waiting for your position. Try again in a moment.": "Väntar på din position. Försök igen om en stund.", "No stand within 150 m of you.": "Inget pass inom 150 m från dig.",
    "Couldn't send. The owner needs to publish the new Firebase rules.": "Kunde inte skicka. Ägaren behöver publicera de nya Firebase-reglerna.", "Letter on the map": "Bokstav på kartan", "Colour": "Färg", "Wind lines in the terrain": "Vindlinjer i terrängen", "Position not working?": "Fungerar inte positionen?",
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
    "Calm mornings scent rises uphill, evenings it sinks along hollows.": "Stilla morgnar stiger vittringen uppför, på kvällen sjunker den längs sänkorna.",
    "Clear": "Klart", "Nearly clear": "Nästan klart", "Variable cloud": "Växlande molnighet", "Half clear": "Halvklart", "Cloudy": "Molnigt", "Overcast": "Mulet",
    "Fog": "Dimma", "Light rain showers": "Lätta regnskurar", "Rain showers": "Regnskurar", "Heavy rain showers": "Kraftiga regnskurar", "Thunderstorm": "Åskväder",
    "Light sleet showers": "Lätta byar av snöblandat regn", "Sleet showers": "Byar av snöblandat regn", "Heavy sleet showers": "Kraftiga byar av snöblandat regn",
    "Light snow showers": "Lätta snöbyar", "Snow showers": "Snöbyar", "Heavy snow showers": "Kraftiga snöbyar", "Light rain": "Lätt regn", "Rain": "Regn",
    "Heavy rain": "Kraftigt regn", "Thunder": "Åska", "Light sleet": "Lätt snöblandat regn", "Sleet": "Snöblandat regn", "Heavy sleet": "Kraftigt snöblandat regn",
    "Light snow": "Lätt snöfall", "Snow": "Snöfall", "Heavy snow": "Kraftigt snöfall", "Whose plans to show": "Vems planer som visas",
    "Stands, stalk routes and sightings. Only changes what you see on this phone.": "Pass, smygrutter och observationer. Ändrar bara vad du ser på din telefon.",
    "Made before names were saved": "Gjort innan namn sparades", "(you)": "(du)", "Unknown": "Okänd", "Follow me (the map turns with you)": "Följ mig (kartan vrids med dig)",
    "Turn off my position": "Stäng av min position", "Follow me": "Följ mig", "Stop following": "Sluta följa", "My scent": "Vittring", "Show my scent cone": "Visa min vittringskon",
    "Centre on me and turn the map the way I face": "Centrera på mig och vrid kartan åt det håll jag tittar", "Show which way I face": "Visa vilket håll jag tittar",
    "Follow mode paused. Tap Follow me to continue.": "Följ mig pausat. Tryck på Följ mig för att fortsätta.",
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
    [/^Scent drifts toward ([A-Z]{1,3})$/, (m, a) => `Vittringen driver mot ${C(a)}`],
    [/^([A-Z]{1,3}) ([\d.]+) m\/s\.?$/, (m, a, b) => `${C(a)} ${b} m/s`],
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
