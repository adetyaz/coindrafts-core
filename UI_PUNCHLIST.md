# UI punch list and handoff

The interface is built on Meadow (see `DESIGN_PRD.md` §3). This file is what's left.
Tick an item only once it's verified in the running app.

## For Fable: 3D, WebGPU and TSL

Owner's brief (2026-11-14): the tracks don't look good, the car models are ugly. Reference:
the Truckful screenshots and trailers (painterly, low-poly, warm lighting, cobbles and
hedges, a chunky pickup).

- [ ] **Car models.** `RaceTrack3D.svelte` builds box cars (`buildCar`). Replace them with a
      proper low-poly model. Keep: paint from `car.color` (CSS colour, resolved with
      `cssColor`), the flame (shown when `accel > NITRO_THRESHOLD`), the "you" marker, and
      the headlight `PointLight` in night worlds.
- [ ] **Track worlds.** Five worlds are token sets in `src/routes/layout.css` (`.track-*`),
      chosen by `src/lib/race/trackTheme.ts`: `meadow` (Scrimmage), `golden` (Versus),
      `neon` (Binary), `night` (Car race), `village` (tournaments and league nights). The
      scene reads colours and `--race-light` from the track's own element. Ground, scenery,
      sky and lighting need real art direction. The road follows real circuit data
      (`src/lib/race/circuits.ts` + `trackPath.ts`): don't change the geometry or the race
      maths (`frame()`: gaps, accelerator, overtakes).
- [ ] **WebGPU + TSL.** Moving to `WebGPURenderer` and TSL materials: keep the WebGL fallback
      path and the `onUnsupported` callback (the race screen falls back to a chart view).
- [ ] **Postcards** (`src/lib/components/race/WorldThumb.svelte`) are flat SVG drawings of
      each world and look poor. Replace them with rendered stills of the real worlds once
      those look right (one per theme, same 16:9).
- [ ] **"I see no cars at all."** Reported by the owner; screen not identified. Check the
      landing demo race, the race screens and the car previews.
- [ ] **Car preview drawing** (`src/lib/components/garage/CarPreview.svelte`) is a flat SVG
      used in the garage, car step, onboarding, player cards and Car Market. It should match
      the new 3D car (a rendered sprite per paint, or an SVG redrawn from the model).
- [ ] **Sponsor ads on track** (billboard, banner, start/finish arch) are planes in
      `RaceTrack3D.svelte`; give them frames and lighting that match the worlds.

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
