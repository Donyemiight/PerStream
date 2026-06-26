# PerStream — Sponsor Pitch Script

> _Read this to Canteen / Circle judges in person or paste it into the submission form._
>
> Time-to-read: 90 seconds.

---

## The 30-second version

> Hi, I'm Ademidun — I shipped TradeMouth solo, came back to Canteen for Lepton, and I built **PerStream**: a per-second USDC streaming paywall for podcasts, built on **Circle Nanopayments + Arc**.
>
> Subscriptions and ad breaks don't fit cold-start creators. Per-second pricing does. Listener presses play, wallet ticks USDC every second, creator earns from listener #1 — no ads, no subs, no audience minimum.
>
> It uses every Circle primitive: Nanopayments for the per-second settlement, Agent Stack for the embedded listener wallet, x402 for the HTTP paywall, Arc for the chain.
>
> [demo](https://perstream-demo.fm): press play, watch the USDC counter tick in real time. Cold-start creators can monetize from day one.

---

## The 90-second version (use this in the submission form)

> PerStream turns podcasts into per-second paid streams.
>
> A creator drops an MP3, sets a price — say 0.0003 USDC per second — and gets a public URL. A listener opens the URL, authenticates with one click (Circle Agent Stack embedded wallet, no MetaMask popup), and presses play.
>
> Every second of playback settles a gasless USDC micro-payment on Arc. Pause stops the meter. Resume restarts it. The creator's dashboard shows earnings in real time.
>
> Why this matters: right now, the only ways for a podcast creator to monetize are ads (need ~5k downloads) or subscriptions (need ~1k subs). That's a cold-start cliff — most creators churn before they monetize. Per-second pricing means **creator #1 with 1 listener earns from second #1**.
>
> It's the cleanest demonstration of Circle's Nanopayments primitive in production: the smallest possible payment ($0.000001), the highest possible frequency (every second), gasless, on Arc. It also showcases the Agent Stack wallet, x402 paywall pattern, and Arc's stablecoin-native design — all four sponsor primitives in one product.
>
> Adoption path: white-label the listen page, embed in canteen.fm, open API for any host. PerStream is also a vehicle for **AI-agent listeners** — fans' agents pre-authorize a daily listening budget and stream autonomously, settling on the same Nanopayments rail.
>
> Demo: [link]. Code: github.com/Donyemiight/PerStream. Creator: Ademidun (donYemiight on X), returning Lepton builder, shipped TradeMouth on the prior Canteen event.

---

## The 5-second version (for the demo video intro)

> PerStream — every second, paid.

---

## Why this lands

- **Problem → solution → infra in one breath.** No fluff.
- **Concrete number**: 0.0003 USDC/sec = $1.08/hr. Judges can do the math.
- **Sponsor-call checklist**: Nanopayments ✓ Agent Stack ✓ x402 ✓ Arc ✓ — every primitive named.
- **Adoption path named**: white-label, embed, open API, agent listeners — shows you think past the hackathon.
- **Credibility line**: "returning Lepton builder, shipped TradeMouth on the prior event" — instantly tags you as serious, not random.

---

## What NOT to say

- ❌ "We use blockchain technology" — judges have heard it 100 times.
- ❌ "Decentralized, trustless" — empty words for this audience.
- ❌ "Just a demo, but imagine if…" — Canteen explicitly penalizes no-traction projects.
- ❌ Anything about HODLing, tokens, NFTs, ICOs — wrong crowd.

---

## What TO emphasize if a judge asks "what's next?"

> Three concrete things, in order:
>
> 1. **RSS import** — any podcast in the world can be PerStream-wrapped in one click. That's the viral loop.
> 2. **AI-agent listeners** — let fans' agents stream on their behalf with a daily USDC budget. This is where PerStream + Circle Agent Stack gets recursive: agents paying agents.
> 3. **White-label API** — embed PerStream's `/listen` widget in any host. Canteen can ship it as a feature, not a separate product.