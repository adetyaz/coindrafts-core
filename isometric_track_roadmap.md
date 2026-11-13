# Roadmap: Building a Continuous Isometric 3D Race Track

This guide outlines the mathematical foundation, computational thinking, and software architecture required to build a continuous, isometric 3D racing track using a Svelte frontend and the Spline runtime.

---

## 1. Required Mathematical Foundations
To build a 3D isometric track, focus on spatial mathematics through coordinate mapping rather than pure abstract calculus.

### Vector Math
* **3D Coordinates (X, Y, Z):** Mapping positions on a 3D spatial grid.
* **Vector Subtraction:** Used to calculate distances and directional headings between two points (e.g., `CarPosition - TargetPosition`).
* **Vector Normalization:** Reducing a vector's length to exactly 1 to isolate pure directional data without speed attributes.
* **Scalar Multiplication:** Scaling a normalized direction vector by speed and frame time to calculate continuous frame-by-frame movement (`Direction * Speed * DeltaTime`).

### Trigonometry & Rotations
* **Sine and Cosine:** Essential for calculating circular pathing, bankings, and sweeping curve paths.
* **Radians Conversion:** Converting standard degree angles into radians for engine computation ($1 \text{ Radian} = 180 / \pi \text{ degrees}$).
* **Quaternions:** Underlying 4-dimensional system used by libraries to calculate rotations smoothly without risking gimbal lock.

### Curves & Splines
* **Linear Interpolation (Lerp):** Moving objects linearly between point A and point B along a timeline.
* **Catmull-Rom Splines:** Algorithms that accept a series of coordinate points and automatically construct a continuous, smoothly flowing curve passing through them.

### Isometric Projections
* **Orthographic Flattening:** Deactivating spatial depth perception so that assets retain uniform dimensions regardless of their distance from the camera view.
* **The Magic Angles:** Positioning your 3D camera at exactly $45^\circ$ horizontal rotation around the vertical Y-axis, combined with a downward tilt of $35.264^\circ$ (calculated via $\arcsin(1/\sqrt{3})$).
* **Grid Conversion Formula:** Projecting standard 2D cartesian coordinates $(X, Z)$ onto an isometric screen space $(X_{\text{iso}}, Y_{\text{iso}})$:
  * $X_{\text{iso}} = (X - Z) \times \cos(30^\circ)$
  * $Y_{\text{iso}} = (X + Z) \times \sin(30^\circ)$

---

## 2. Technical Stack & Architecture
Integrating interactive 3D elements natively into web clients requires specific runtime configurations.

### Code & Frameworks
* **Frontend Runtime:** Svelte framework using lifecycle hooks like `onMount` to handle WebGL contexts safely after DOM binding.
* **Algorithmic Language:** TypeScript or modern JavaScript to handle matrix transformations and array state data cleanly.
* **Visual Rendering:** `@splinetool/runtime` to link your browser canvas directly to interactive, cloud-hosted Spline scene layers.
* **Alternative Math Drivers:** Standalone math libraries like `three` or `gl-matrix` for advanced coordinate manipulation.

### The Component Setup (Svelte Example)
* Target your `<canvas>` wrapper directly using Svelte's `bind:this` attribute.
* Instantiate the Spline `Application` class inside your initialization logic.
* Use `.load()` methods targeting valid cloud or local `.splinecode` assets.
* Target named scene objects directly inside resolved promises via `.findObjectByName()`.

---

## 3. Algorithmic Track Generation Strategies
To make a track go on forever without manual building, use automated procedural patterns.

### The Conveyor-Belt Chunk Method
* Maintain a pool of static track segments (e.g., Straights, Left Corners, Right Corners) built with matching entrance and exit dimensions.
* Track the track's execution using a directional grid system (North, South, East, West).
* Continuously push new valid connecting pieces to the front of a tracking array while deleting trailing pieces that drift out of the camera's active view frustum.

### Spatial State Checking
* Log the heading vector of the final track piece's endpoint.
* Filter your segment pool to only select new pieces whose starting connector matches that inverse vector.
* Execute bounding box collision algorithms to guarantee that randomly picked turns never fold back into existing tracks.

---

## 4. Problem-Solving Skill Training Plan
Train your code logic step-by-step to prevent getting overwhelmed by complex 3D projects.

* **Decomposition:** Isolate complex mechanics into simple test cases. Never code an entire rendering engine and an infinite loop algorithm simultaneously.
* **2D Prototyping:** Build your procedural array appending logic entirely in a 2D canvas with flat squares first. Once the loop works flawlessly, swap the logic into 3D.
* **Pseudo-Coding:** Document your architecture in human language step-by-step prior to writing any TypeScript syntax.
* **Isolated Script Testing:** Test matrix calculations inside independent Node environments using `console.log()` statements before bringing them into live game UI loops.

---

## 5. Real-Time Weather System
The track mirrors the weather and time of day where the viewer is right now.

### Ground Rules
* **Cosmetic only:** weather never changes speed or positions — the market decides the race. Rain on your screen is not a penalty.
* **Per viewer:** each player sees their own local weather. In a Versus race, you might see rain while your opponent sees sunshine on the same race.

### Where the Weather Comes From
* **Location without a permission popup:** approximate city from the request's IP on the server (the hosting platform supplies coarse location headers). Optional opt-in to the browser's precise location for a closer match.
* **Weather data:** a weather API queried server-side by rounded coordinates (e.g. to ~10 km), cached per area for ~15 minutes so thousands of players in one city cost one call. Check the provider's licence for commercial use.
* **Privacy:** only coarse location, never stored against the player.
* **Fallback:** no location or API failure → clear weather at the viewer's local time.

### What It Changes in the Scene
| Condition | Visual |
|---|---|
| Clear | Bright sun, crisp shadows |
| Cloudy | Soft, flat lighting, drifting cloud shadows |
| Rain | Rain particles, wet road reflections, spray behind cars |
| Storm | Heavy rain, lightning flashes, darker sky |
| Snow | Snowfall, white track edges |
| Fog | Distance fog, headlights on |
| Wind | Flags and banners flapping, particles drift sideways |
| Night | Darker sky, headlights, lit billboards (local time) |

### Implementation Notes
* **Lighting:** one directional light (sun/moon) whose angle and color follow local time; ambient light dims with cloud cover.
* **Particles:** pooled and capped (fewer on phones); one particle system re-used for rain/snow.
* **Transitions:** weather fades in over a few seconds when it changes mid-race; never snaps.
* **Settings:** Real weather (default) · Always clear · Pick a weather. Reduced motion → no particles, lighting only.
* **2D-first rule (from section 4):** prototype weather as a state switch on flat shapes before adding 3D effects.