# CoinDraft Project Doc

## Purpose

This is the working project document for CoinDraft. It is intentionally open for redefining, so the product shape, naming, and launch scope can be adjusted as the build evolves.

## Product Summary

CoinDraft is a wallet-first crypto fantasy game built around real market data. Users connect a wallet, draft five token picks, submit a lineup into a contest, and see the result resolve from SoSoValue market movement. The product is designed to feel like fantasy sports on the surface and market research underneath.

## Product Vision

Build a gamified crypto intelligence platform where users learn through daily market challenges, draft fantasy token lineups powered by live SoSoValue data, and compete in short-form contests that turn research into strategy.

## Core Promise

The user should always feel three things:

1. The data is real.
2. The game is simple to enter.
3. The result teaches them something useful about the market.

## Design Principles

| Principle                         | Meaning                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Research is the cheat code        | Learning and market context should give a visible edge in the draft.                            |
| Familiar format, unfamiliar depth | The fantasy game hook should stay obvious while the underlying research layer stays meaningful. |
| Show, don’t lecture               | AI explanations belong after the result, not before the play.                                   |
| Points first                      | XP, streaks, wins, and standings are the main currency in Wave 1.                               |
| Data integrity                    | Market data shown to users must come from SoSoValue or approved fallback logic.                 |

## Target User

- Crypto-native user with a wallet
- Wants a quick daily contest instead of a long research workflow
- Cares about momentum, sector rotation, and narrative moves
- Prefers learning through play rather than reading analysis up front

## Current Product State

### Already implemented

- SvelteKit + TypeScript app scaffold
- Drizzle + Neon integration
- Wallet-first Reown auth flow
- Session cookie creation and validation
- Nonce, verify, and logout auth routes
- Wallet-based user, contest, lineup, and lineup pick schema
- SoSoValue server client with cache and retry handling
- Market data routes for tokens, sectors, ETF, news, and snapshots
- Dashboard UI with live market context
- Draft UI for five-pick lineup creation
- Lineup submission backend
- Result resolution backend
- Result page wired to resolved contest data

### Still planned

- Push schema to Neon and finalize migration state
- Seed test data for demo and development
- Run e2e checks on the draft-to-result loop
- Deploy to Vercel

## Product Flow

1. User lands on the app and connects a wallet.
2. User lands on the dashboard and sees live market context.
3. User opens draft and selects five picks across the allowed pool.
4. User submits the lineup into a contest.
5. The system records the lineup, captures entry prices, and marks the contest live.
6. When the contest resolves, the system fetches fresh snapshots and scores each pick.
7. The result page shows the final score, win/loss state, XP, and pick breakdown.

## Feature Scope

### 1. Authentication

- Wallet connection is handled through Reown.
- The server issues a nonce and verifies signatures.
- Successful verification creates a session cookie.
- Protected routes require a valid session.

### 2. Dashboard

- Shows live market context.
- Surfaces contest entry points.
- Uses SoSoValue-powered data panels.

### 3. Draft

- Allows exactly five picks.
- Lets the user choose tokens from the pool.
- Stores the lineup in the database.
- Captures entry prices at submission time.

### 4. Contest Resolution

- Pulls fresh snapshots from SoSoValue.
- Computes percent change and score per pick.
- Calculates total lineup score.
- Marks the contest resolved.

### 5. Result View

- Shows win/loss state.
- Shows XP earned.
- Shows your score and opponent score.
- Shows a per-pick breakdown.

## Wave 1 Non-Goals

- No complex tournament bracket system
- No social feed or chat
- No mobile native app
- No email/password auth flow
- No advanced portfolio optimization engine
- No full multiplayer matchmaking

## Design Direction

The visual language should feel intentional and slightly surprising, not generic SaaS.

### Color Roles

| Role           | Hex     | Usage                                     |
| -------------- | ------- | ----------------------------------------- |
| Primary brand  | #534AB7 | Primary CTA, active states, brand moments |
| Brand light    | #EEEDFE | Badges and soft emphasis                  |
| Positive       | #0F6E56 | Gains, wins, streaks                      |
| Positive light | #E1F5EE | Positive backgrounds                      |
| Negative       | #993C1D | Losses and alerts                         |
| Negative light | #FAECE7 | Negative backgrounds                      |
| Neutral        | #888780 | Secondary text                            |

### Typography

- Use a clean system-based stack for Wave 1
- Heading weight should stay at 500
- Body text should stay readable and calm
- Micro labels and badges should stay compact and consistent

### Component Patterns

- Cards: white surface, subtle border, 12px radius
- Metric cards: softer surface, low visual weight
- Badges: pill-shaped, color-coded by state or sector
- Primary CTA: purple background with light text
- Secondary CTA: transparent or lightly bordered

## Data Model Scope

### Users

- Wallet-address based identity
- Session tied to wallet verification

### Contests

- Owned by a user
- Track status, type, start time, end time, and winner

### Lineups

- Belong to a contest and user
- Track lock state and final score

### Lineup Picks

- Store token identity, sector, currency ID, entry price, exit price, pct change, and score

## API Map

### Auth

- `GET /api/auth/nonce`
- `POST /api/auth/verify`
- `POST /api/auth/logout`

### Contest

- `GET /api/contests`
- `POST /api/contests`
- `POST /api/contest/[id]/lineup`
- `GET /api/contest/[id]/result`

### Market Data

- `GET /api/tokens`
- `GET /api/sectors`
- `GET /api/etf`
- `GET /api/news`
- `GET /api/snapshot/[id]`

## SoSoValue Integration Notes

SoSoValue calls must stay server-side. The browser should never call the API directly.

### Integration Rules

- Base URL: `https://openapi.sosovalue.com/openapi/v1`
- Auth header: `x-soso-api-key`
- Response wrapper: `code`, `message`, `data`
- 429 responses should use `retry_after`
- Snapshot data should be cached briefly
- Token list and static metadata should be cached longer

### Primary Data Use

- Token pool for draft
- Sector grouping for draft filters and dashboard modules
- Market snapshots for live scoring
- ETF history for whale watch style insights
- News feed for post-match narrative context

## Screen Map

### Home Dashboard

- Entry point after login
- Shows market context and contest CTA

### Draft Screen

- Builds the five-pick lineup
- Uses sector filters and token pool

### Live Contest Screen

- Shows score progression during the contest window

### Result Screen

- Shows resolution, score, and narrative breakdown

### League Screen

- Future scope for standings and history

## What Has Been Built So Far

This section is intentionally factual and current.

- Reown wallet auth is active.
- Session cookies are issued after signature verification.
- The app is protected by layout-level session loading.
- The dashboard has been reshaped into a live contest entry experience.
- The draft flow can submit a lineup.
- The contest result flow can resolve picks from fresh snapshots.
- The result page can render real contest output from the backend.
- SoSoValue is wired through server-only helper functions.

## Remaining Build Work

- Push schema changes to Neon
- Run Drizzle migration flow
- Seed test data for launch/demo
- Validate the full draft-to-result path with e2e checks
- Prepare deployment settings for Vercel

## Risks

- SoSoValue rate limits or response shape changes could affect live scoring.
- The opponent model is simplified and may need to be replaced with a real bot lineup later.
- Legacy auth pages still exist and produce non-blocking warnings.

## Open Questions

- Should contest resolution be automatic, manual, or triggered on first view?
- Should lineup submission overwrite an old lineup or lock a one-time submission?
- Should the opponent be synthetic for Wave 1 or backed by a real generated lineup?
- How much of the product should remain rebrandable before launch?

## Success Criteria

- A user can connect a wallet and create a session.
- A user can submit a five-pick lineup.
- A contest can resolve from live market data.
- The result page can display a meaningful outcome.
- The app can be deployed with Neon as the backing database.

## Suggested Next Redefinition Areas

If this doc gets revised, the most likely sections to reshape are:

- Product naming and positioning
- Contest format and scoring model
- Visual direction
- Opponent logic
- Launch scope versus Wave 2 scope

_Living project doc · open for redefining_
