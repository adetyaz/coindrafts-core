# UI punch list and handoff

The interface is built on Meadow (see `DESIGN_PRD.md` §3). This file is what's left.
Tick an item only once it's verified in the running app.

## For Fable: 3D, WebGPU and TSL

Owner's brief (2026-11-14): the tracks don't look good, the car models are ugly. Reference:
the Truckful screenshots and trailers (painterly, low-poly, warm lighting, cobbles and
hedges, a chunky pickup).

- [ ] **Car models.** **Built, check in app:** 12 vehicles from a CGTrader low-poly pack
      (SUVs, pickups, tractors, trucks) in `static/models/cars/*.glb`, mapped to Showroom
      names in `src/lib/race/scene/models.ts` (Commons are cars, Rares tow or plough, Epics and
      Legendaries are trucks). The body is repainted in the driver's colour; ink outline.
      While a model loads (or if it fails) the built-in pickup (`car.ts`) races instead.
      Source pack and converter: `assets-src/` (gitignored; licence: never put the source in
      `static/`). Re-run: `blender -b --python assets-src/convert_cars.py -- <fbx> <out>
      <previews> <texture>`.
- [ ] **Track worlds.** **Built, check in app:** `src/lib/race/scene/worlds.ts` dresses each
      world, all instanced and seeded by the circuit. Meadow: round trees, bushes, flowers,
      hedges, sheep. Golden: swaying wheat (TSL), hay bales, poplars. Night: pines, lamp posts
      (6 real lights), fireflies (TSL). Neon: tower blocks with lit windows (TSL), neon posts.
      Village: cottages with roofs, cobbled road (TSL Worley), hedges, flags. Road geometry and
      race maths are unchanged; the road is drawn 12 wide instead of 7.
- [ ] **WebGPU + TSL.** **Built, check in app:** `RaceTrack3D.svelte` runs on
      `WebGPURenderer` (falls back to WebGL2 by itself; `onUnsupported` still fires if neither
      starts). TSL materials in `src/lib/race/scene/materials.ts` (grass patches, asphalt
      grain, painted lines, cobbles, windows). Bloom on night and neon worlds.
- [ ] **"I see no cars at all."** **Likely fixed, check in app:** the old camera framed the
      whole circuit, so a car was ~6px on a phone. The default view is now **Follow** (close
      on your car, about 62 units across); **Track** is the old whole-circuit view; **Chase**
      kept. Check the landing demo race, the race screens and the car previews.
- [ ] **Postcards** (`src/lib/components/race/WorldThumb.svelte`) are flat SVG drawings of
      each world and look poor. Replace them with rendered stills of the real worlds once
      those look right (one per theme, same 16:9).
- [ ] **Car preview drawing** (`src/lib/components/garage/CarPreview.svelte`) is a flat SVG
      used in the garage, car step, onboarding, player cards and Car Market. It should match
      the new 3D car (a rendered sprite per paint, or an SVG redrawn from the model).
- [ ] **Sponsor ads on track** (billboard, banner, start/finish arch). **Built, check in
      app:** the art now sits on cream boards with ink posts, readable from both sides.

## Detail pass (UI)

- [ ] Dashboard has unnecessary white space (owner, 2026-11-14). **Fixed, check in app:** hero
      is text + a 15rem postcard (hidden on phones), tighter stats and section gaps.
- [ ] Landing: vertical scrollbar on "Most drafted today". **Fixed, check in app.**
- [ ] Race hub: "Race now" cards too skinny. **Fixed, check in app.**
- [ ] Remaining utility-styled bits run through the bridge rules in `layout.css`; delete
      bridge rules as screens stop needing them.
- [ ] `/design/rps` and `/design/pickers` are sandboxes and keep their old look.
- [ ] `/lobby/[id]/result` is legacy (superseded by `/race/[id]`): remove or redirect.

## Not verified

Nothing has been checked in a running app with live data. Checks so far: type-check,
lint (no new errors), production build, a static sample page at 1360px and 390px, and the
share card rendered to PNG.
