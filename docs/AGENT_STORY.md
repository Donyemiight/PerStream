# PerStream — The Agent Story

> _Why PerStream wins the Lepton Agents Hackathon (not just a hackathon about agents, but a hackathon where agents are the buyers)._

---

## The problem with current creator monetization

Creators can't monetize from listener #1 today. The reasons:

- **Subscriptions** need ~1,000 subs (Patreon's cold-start)
- **Ads** need ~5,000 downloads (audio CPM thresholds)
- **Tip jars** earn nothing for the creator unless the listener voluntarily pays
- **Bundle pricing** (per-episode, per-album) overcharges casual listeners

The cold-start cliff kills 90% of new creators before they monetize.

## The insight: agents are the missing buyers

Today's creator economy assumes **humans buy**. But in 2026, **AI agents are the new buyers**:

- AI agents that summarize podcasts for their users
- AI research agents that compile audio reports
- AI personal-assistant agents that listen on behalf of busy humans
- AI news aggregators that consume audio content 24/7

These agents **don't have ad-skip reflexes. They don't have subscription fatigue.** They just have a USDC wallet and a goal: get the content, settle the payment, log the consumption.

PerStream makes them first-class economic actors.

## How PerStream serves agents

### 1. Agent provisions its own wallet

```bash
POST /api/agent/listen
{
  "trackId": "trk-welcome",
  "budgetUsd": 1,
  "maxSeconds": 60
}
```

The agent doesn't need a human to create a wallet, deposit money, or sign transactions. PerStream + Circle Agent Stack handle wallet provisioning via embedded wallet flow — the agent has a USDC address and balance in one call.

### 2. Agent pays per-second

The agent opens a session:

```bash
POST /api/listen/start
{ "trackId": "trk-welcome" }
```

PerStream's meter ticks once per second. Each tick:
1. Calls `PerStreamPaymaster.tick()` on Arc
2. Debits the agent's wallet by `0.0003 USDC` (or creator's chosen price)
3. Credits the creator's wallet
4. Emits an event for the consumption log

This is gasless via Circle Nanopayments — the agent doesn't need a separate gas token.

### 3. Agent stops when budget runs out

```bash
GET /api/listen/poll
```

The agent's session is alive as long as it has balance. When the budget hits zero, the meter stops. The agent returns a consumption record:

```json
{
  "trackId": "trk-welcome",
  "secondsPlayed": 60,
  "totalPaidUsd": "0.018000",
  "remainingBalanceUsd": "0.982000"
}
```

### 4. Agent runs autonomously (multi-track discovery)

```bash
POST /api/agent/auto
{
  "budgetUsd": 5,
  "maxTracks": 3
}
```

The agent:
1. Sees a $5 budget
2. Discovers available tracks
3. Picks one (shortest, cheapest — a reasonable strategy)
4. Listens, paying per-second
5. When track ends or budget runs low, picks the next
6. Stops when budget is empty or maxTracks hit
7. Returns full consumption log

**Zero human input.** This is the agentic commerce the brief explicitly asks for.

## Why Circle infra is essential

This only works because Circle solved the hard parts:

| Problem | Circle's solution |
|---|---|
| Sub-cent fees make per-second billing uneconomic | **Nanopayments** — gasless, $0.000001 minimum |
| Wallets are too hard for agents to use | **Agent Stack** — embedded wallets, one-call provisioning |
| Cross-chain USDC is fragmented | **CCTP + Gateway** — settle on any chain |
| No payment standard for HTTP | **x402** — server returns 402, agent pays, gets content |

PerStream is the **demonstrator** that ties all four together in a real product.

## Why Arc is essential

Arc's stablecoin-native L1 gives PerStream:

- **Predictable fees** (~$0.01 USDC per tx, no gas token speculation)
- **Sub-second finality** (agents don't wait 30s for confirmations)
- **Stablecoin-native settlement at protocol level** (USDC is a first-class citizen, not a token)

For per-second micropayments at scale, this is the only chain that makes the math work.

## Adoption path beyond the hackathon

1. **Open-source SDK** — `npm install perstream-agent-sdk` lets any agent integrate
2. **RSS-import pipeline** — any podcast becomes PerStream-enabled with one click
3. **White-label API** — embed the listen widget in any podcast host
4. **AI agent marketplace** — let agents advertise their services, sell "summarized podcast" deliverables to other agents

The recursive loop: **agents pay agents, settled on Arc, using Circle rails, monetizing creators who were previously invisible to the agent economy.**

---

## Demo narrative (2 minutes)

> PerStream turns every podcast into a stream of payable seconds.
>
> Here's an AI listener agent — its own USDC wallet, a $5 budget, the goal "discover and consume audio autonomously."
>
> Watch the screen. The agent picks a track. Press play.
>
> Every second, USDC ticks from the agent's wallet to the creator's. The meter is at 0.0003 USDC per second — that's $1.08 per hour of listening.
>
> The agent doesn't have a MetaMask popup. It doesn't need a human. It runs until its budget runs out, then it stops.
>
> Same flow, same primitives, real Circle Nanopayments on Arc. The difference: this would be impossible without gasless sub-cent micropayments.
>
> PerStream — every second, paid. By humans or by agents.

---

## TL;DR for the judges

- **Brief asked for:** AI agents as economic actors, paying for services via nanopayments on Arc.
- **PerStream delivers:** An autonomous listener agent that provisions its own wallet, pays per-second for audio, runs without humans.
- **Sponsor primitives used:** Nanopayments (per-second settlement) + Agent Stack (wallet provisioning) + x402 (HTTP paywall) + Arc (settlement).
- **Why it matters:** Creators with 0 listeners can now monetize. Agents with $5 budgets can consume 16+ hours of audio. A new creator × an AI agent = economic activity that didn't exist before.

Built by **Oluyemi (donyemiight)** for the Lepton Agents Hackathon 2026.