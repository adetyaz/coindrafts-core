# CoinDraft — demo video script

**Length:** about 2 minutes 30 seconds (the rules allow 1–3 minutes).
**Format:** screen recording with voiceover, 1080p, phone-width browser window for the
race shots if you can (it reads better on X), desktop width for the rest.
**One story:** _a new player signs in with email, gets a car that's really theirs on
NEAR, races it on a real circuit, and the economy around them is alive._

---

## Before you record (10 minutes of prep)

1. **Live site works:** Vercel has the env vars (NEAR, Groq, VAPID, `ADMIN_USER_IDS`).
2. **A fresh email account** for the sign-in shot (a new Google account, or an email
   alias), so the first-car reveal actually appears.
3. **A second, seasoned account** (one of yours) with a few hundred Gears, a couple of
   races played and a non-starter car, for the Garage, Car Market and car race shots.
4. **A trackside ad that's live**, so it shows on the 3D track: book a billboard on
   Monza for today on `/sponsor/ads` with any logo, then approve it at
   `/admin/sponsors` (Mark paid → Approve). Race on Monza in the demo.
5. **A tournament with a fresh draw:** create one on `/tournament` that closes in 10
   minutes, join with the seasoned account, and open its page right after the draw so
   the seats animate in. Or film the Daily Monza Cup draw at 18:00 UTC.
6. **Bot world populated:** press **Simulate a week** on `/car-market` once beforehand
   so listings, sales and "Yesterday in the bot world" have content.
7. **The NEAR explorer** open in a tab on the garage contract:
   `https://testnet.nearblocks.io/address/garage.coindraft.testnet`.
8. Close other tabs, hide bookmarks, turn off notifications on your machine.

Shots marked **(cut)** are fast cuts you can trim if you run long.

---

## The script

| Time      | On screen                                                                                                                                                                                                           | Voiceover                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:10 | **Landing page.** The live demo race in the hero: four bots lapping a real circuit, positions shifting.                                                                                                             | "This race is the crypto market. Each car's engine is five coins, and live prices decide who's in front."                                                           |
| 0:10–0:25 | Click **Sign in to race** → **Continue with email/Google**. No wallet popup. Lands on **Your first car**: the reveal, "+⚙️ 500 Gears", "Recorded on NEAR. You'll never need a wallet."                              | "I sign in with email. No wallet, no seed phrase, no gas. And I get my first car, and it's mine: a token on NEAR."                                                  |
| 0:25–0:35 | Type a racing name, the email is pre-filled. **Start your first race.**                                                                                                                                             | "Pick a name, and straight into a race."                                                                                                                            |
| 0:35–0:55 | **Car step** (last car pre-selected) → **Track step**: the four real circuit outlines, pick **Monza** → **Draft**: drop one coin into each sector. Pick a **Nitro** in the item tray (seasoned account) → **Lock**. | "Choose the car, choose a real circuit, built from measured track data. Then the draft: one coin per sector. That's my engine."                                     |
| 0:55–1:05 | **Pre-race grid:** driver cards, the bot's tagline and taunt ("New face. Let's see what you've got."), start lights, **GO**.                                                                                        | "My rival's a bot with a personality. It remembers every race we've had."                                                                                           |
| 1:05–1:25 | **The race in 3D.** Cars lapping Monza, an overtake with sparks, the flame when a car accelerates, the **sponsor billboard** beside the straight. Toggle **Chase** camera for 2 seconds.                            | "Every second, my coins' moves speed my car up or slow it down. When they pump, I overtake. That billboard? A sponsor booked it on this real circuit."              |
| 1:25–1:35 | **Podium → Result:** YOU WON, ⚙️ Gears earned, the bot's line ("You got me this time."), the pick breakdown.                                                                                                        | "Win, and I earn Gears, the game's currency."                                                                                                                       |
| 1:35–1:55 | **Garage** (seasoned account): cars with races and wins, **Customise** a paint and watch the preview change; the **NEAR panel** → click **account** → the explorer tab showing the account's mint and transfers.    | "Gears buy new cars and paint jobs, and spending them burns them. Everything here is on chain: this is my account on the NEAR explorer, every car and every trade." |
| 1:55–2:10 | **Car Market:** going rate per tier with its reason, a bot's listing with "Why:", **Yesterday in the bot world** expanded (races, a car won, a Showroom buy).                                                       | "The market's alive. Bots trade by their own rules, and every price shows its reason. Even with nobody online, the bots race and trade every day."                  |
| 2:10–2:20 | **(cut)** **Car race:** pick a car to stake → the warning "Winner takes both cars."                                                                                                                                 | "Feeling brave? Stake your car. The contract holds both until the winner drives off in them."                                                                       |
| 2:20–2:30 | **(cut)** **Tournament draw** animating seat by seat into groups of 5, BOT tags filling seats.                                                                                                                      | "Tournaments draw you into groups by strength. Bots fill the empty seats."                                                                                          |
| 2:30–2:40 | **(cut)** **Binary race:** the five checkpoint gates on the lap flipping green and red.                                                                                                                             | "Or call five coins up or down, one checkpoint each."                                                                                                               |
| 2:40–2:50 | Back to the **landing hero** race, CoinDraft logo, the line on screen.                                                                                                                                              | "CoinDraft. Draft coins. Race them. Built on NEAR."                                                                                                                 |

---

## If you have to cut to 90 seconds

Keep 0:00–1:35 (sign-in, first car, draft, race, result), then one shot of the NEAR
explorer (1:35–1:55), then the closing line. That's the whole pitch: email sign-in,
a car that's really yours on NEAR, the market driving the race.

## Recording tips

- Record each shot separately and cut them together; don't try one take.
- Use 1-minute race lengths for the race shot so it finishes on camera.
- Slow the mouse down; pause half a second before each click.
- Read the voiceover after editing, over the cut, so timing fits.
- Captions help on X (most people watch muted): burn in short captions of the voiceover.

## Post it

Use the suggested post text in `SUBMISSION.md` (it includes the required
**NEAR HACKATHON** mention, **@NEARProtocol** and **#NEARHackathon**), attach the video,
post from your account, and paste the post link into the submission form.
