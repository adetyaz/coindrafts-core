# UI punch list

Details to fix after the screens are all rebuilt. Owner feedback is quoted with the date;
tick an item when it's verified in the running app.

## From the owner, 2026-11-14 (first look at the Meadow pass)

- [ ] **3D tracks don't look good.** The five worlds (meadow, golden, night, neon, village)
      need real art direction: ground texture, scenery, lighting. Reference: the Truckful
      screenshots and trailers.
- [ ] **Race car models are ugly.** Replace the box cars in `RaceTrack3D.svelte` with a proper
      low-poly model (the Truckful pickup is the reference), keeping paint and headlights.
- [ ] **"I see no cars at all."** Find out where: garage cards, the car step, or the landing
      demo. Not yet reproduced (the app hasn't been run from here).
- [ ] **Dashboard has unnecessary white space.** Tighten the next-move card and the grid.
- [ ] **Race hub postcards are ugly** (`WorldThumb.svelte`). Redraw, or use rendered stills
      of the real 3D worlds once those look right.
- [x] Landing: vertical scrollbar on "Most drafted today" (rail now scrolls sideways only).
- [x] Race hub: "Race now" cards too skinny (minimum width raised to 21rem).

## Known, not yet rebuilt on Meadow components (bridge styling only)

Car Market · tournaments list and page · leagues · leaderboard · profile (Me) · player and
bot cards · binary draft · car race · scrimmage and Versus queue · multi-car race page ·
sponsor pages · guide (content is also out of date).

## Not verified

Nothing has been checked in a running app with live data. Checks so far: type-check, lint,
production build, and a static sample page at 1360px and 390px.
