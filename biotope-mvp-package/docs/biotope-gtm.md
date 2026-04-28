# Biotope — Go-to-Market Design

*Companion to `biotope-design.md` (full design) and `biotope-mvp-planning.md` (B-3 product MVP).*

This document defines the go-to-market strategy for Biotope, a parent-and-child ecological learning app shipping first as **Variation B-3 (mobile-first)**. It is calibrated to a **solo developer** with deep MarTech, indie game, toy-to-life, and embedded-systems experience, drawing on a curated personal network for specialist contracting.

---

## 1. Executive Summary

Biotope ships under the existing **Lights Out Games** publisher brand as a free-to-play mobile app for parents and children ages 5–12. Three monetization tiers form a freemium funnel: **Free** (sandbox + a few always-free scenarios), **Digital Subscription** (~$9.99/mo for the full digital scenario library), and **Hybrid Subscription** (~$24.99/mo — digital library plus quarterly low-cost reusable physical kits that unlock kit-required scenarios).

The competitive frame is positioned between **ABCmouse** (digital-only, $12.99/mo, broad early-childhood) and **CrunchLabs / KiwiCo** (physical kits, $25–40/mo, kit-led with optional digital). Biotope's differentiation is **place-based outdoor learning with a parent-coplay model** — neither competitor maps locality and real-world outdoor activity into the loop the way Biotope does.

The founding operator profile fits this venture unusually well: **founder-level toy-to-life experience** (Prizm Labs, US patent), **DIY electronics manufacturing experience** (Olaunch), **shipped F2P-with-IAP experience** (Scopely / Dice With Buddies), and **5+ years as a MarTech Solutions Architect** at 6sense, mParticle, AppsFlyer, and TestBox. The asset production strategy targets **100% of development assets and >75% of production assets self-produced**, with the remaining ~25% concentrated where contractor quality is non-substitutable (rigged 3D character animation, kids' VO casting, original score for emotional anchor moments, App Store hero creative).

GTM sequencing is organic-first: a 6-month pre-launch period that compounds content and waitlist, then a one-geography soft launch of the free tier, then digital subscription, then a manually-fulfilled hybrid kit pilot in LA before scaling logistics. Paid acquisition stays modest until organic CAC and 30-day retention curves are proven.

---

## 2. Founding Team & Capabilities

### Solo founder

**Mike Garrido**, principal of Lights Out Games (Sep 2021–present).

Background that maps directly onto Biotope's surface area:

| Biotope component | Founder background | Years |
|---|---|---|
| Toy-to-life hybrid kit | Prizm Labs (CPO + co-founder, acquired by Blok Party); US patent on physical/virtual game systems | 2014–2017 |
| DIY electronics kit production / fulfillment | Olaunch (Product Development Advisor); 20+ Arduino-based kits, branding, retail + DTC | 2013–2017 |
| AR/VR controller hardware | GestAR (Product & BD, co-founder) | 2017–2019 |
| F2P + IAP economics on a real social-game scale | Scopely (Web Developer, *Dice With Buddies*, 500K+ MAU, $2K+ daily IAP) | 2013–2014 |
| Mobile attribution & customer data infrastructure | AppsFlyer (Solutions Architect), mParticle (5 roles, Senior SA) | 2020–2024 |
| GTM intelligence / ABM / account engagement | 6sense (Principal Solutions Architect, current) | 2025–present |
| UGC games platform strategy | Super Jump Games (Technical Advisor) | 2023–present |
| Educational design for middle / high school audiences | Center Theatre Group (Education/Outreach Intern) | 2009 |
| Subject authority — ecology / permaculture | Permaculture Design Certificate; container gardens; "solarpunk" hobbyist publishing | ongoing |
| Audio production capability | Modular synthesizer hobbyist | ongoing |
| Visual design capability | Theatre BA + USC Web Apps degree; Illustrator/Photoshop in shipped roles | ongoing |
| Web / full-stack engineering | 15+ years across BackboneJS, AngularJS, React, ASP.NET, PHP, Ruby, Objective-C | 2010–present |

**The unusually strong fit-to-venture is itself a GTM asset.** Press, App Store editorial, partnership outreach, and waitlist-content all benefit from a founder narrative that genuinely connects every product decision to lived experience. Lead with it.

### Personal network for contractors

Specialist roles that should be drawn from network rather than learned:

| Role | Network source | Engagement model |
|---|---|---|
| Senior 3D artist + rigger/animator | Game-industry contacts (Super Jump Games co-founders ex-EA/THQ/Kabam; Star Wars: Clone Wars veterans) | Per-asset contract; 3–5 hero animals + characters in MVP |
| Children's voice acting (parent-narrator) | LA voiceover agents; Center Theatre Group alumni | Per-session; 1–2 days for MVP scenarios |
| Original music composition (ambient + emotional anchors) | Modular synth / LA music scene | 5–8 short cues for MVP; can self-produce most BGM |
| Children's UX design review | Family-tech / ed-tech network (incl. ex-Prizm Labs, ex-Scopely contacts) | Hourly consult; 10–20 hr for MVP |
| Manufacturing partner for hybrid kit | Olaunch supply-chain contacts; small-batch electronics manufacturers | Cost-plus per unit; manual fulfillment for first batch |
| Children's privacy / COPPA legal | LA tech-startup legal counsel | Flat-rate review of policies + ToS |
| Educational consultant (curriculum alignment) | Permaculture and Wild + Free / homeschool network | Hourly; one focused engagement before launch |
| App Store / Play store optimization | MarTech network (mParticle / AppsFlyer alumni) | Hourly consult or revenue-share on conversion improvements |

**Total budgeted contracting bench for first 12 months: 8–12 specialists, $40–80K cumulative spend.** A rough working assumption — to be tightened per the MVP doc.

---

## 3. Asset Production Pipeline

### Production targets

- **100% of development assets** produced or procured by founder
- **>75% of production (shippable) assets** produced or procured by founder

### Definitions

- **Development assets** = anything used during development that does not ship to players: placeholder art, dev tools, internal docs, prototype models, graybox scenes, scratch audio.
- **Production assets** = anything that ships to players: final 3D models, polished UI illustration, recorded voice-over, mastered audio, marketing creative, App Store hero imagery.

### Self-produced (the >75%)

| Category | Tooling | Founder leverage |
|---|---|---|
| 2D illustration / icons / UI art | Procreate, Illustrator, Photoshop | Theatre + design background; shipped 1K Studios / Scopely / TV web work |
| Storyboards / scenario flows | Figma, ink-on-paper-then-scan | Same |
| 3D placeholder + simple props | Blender, Meshy AI / Tripo3D for first-pass, then hand-cleaned | Adequate for ~70% of scenes |
| Ambient background audio | Modular synth rig + Ableton | Existing hobby capability |
| Basic SFX | Self-recorded foley + Ableton | Standard for solo indie pipeline |
| Photographic reference (real local fauna/flora) | Phone camera + LA-area access | Permaculture credentials → access to gardens, parks, nurseries |
| Voice-over (placeholder + some final) | Self-recorded narrator track | Acceptable for some parent-narrator beats; final hero VO contracted |
| Marketing creative (App Store, social, web) | Figma + Photoshop + Capcut | MarTech background → full creative production |
| Narrative writing (Ink scripts) | VS Code + Inky | Theatre BA |
| Code (everything) | Vite + R3F + TypeScript | 15 years full-stack |

### Contracted-out (the <25%)

The ~25% gap is intentional and concentrated where contractor quality is non-substitutable for shipped content:

| Category | Why contract | Volume in MVP |
|---|---|---|
| **Hero rigged 3D characters with animation** (the bird, the squirrel, the frog) | Animation quality is the difference between charming and uncanny; this is the single most player-visible asset class | 3–5 characters, ~$8–15K |
| **Children's parent-narrator VO (final ship)** | Adult voice acting for kids' content is a craft; warmth and pacing matter | 1–2 sessions, ~$2–4K per language |
| **Original score for emotional anchor moments** | Most ambient BGM self-produced; specific themes (intro, unlock, reflection) benefit from a composer | 5–8 cues, ~$3–6K |
| **App Store hero / featuring submission creative** | Apple's Today and Kids feature placements have visual standards | One push per major release, ~$2–4K each |
| **Children's UX design review pass** | One-on-one playtest analysis from a specialist | ~$1–2K |
| **Cover audio mastering** | Post-production polish | ~$1K |

### AI-assisted production

AI is in the **development asset** pipeline; only sparingly in production:

- **Concept art + mood boards** — Midjourney / Stable Diffusion XL for ideation, never for shipped assets.
- **3D placeholder mesh generation** — Meshy AI / Tripo3D for first-pass meshes, hand-cleaned in Blender before ship.
- **Code scaffolding** — Claude / Cursor for boilerplate, manifest validation, test generation.
- **Voice-over scratch tracks** — ElevenLabs for prototyping pacing before contracting real talent.
- **Asset naming, tagging, batch processing** — local LLM for pipeline orchestration.

AI generation is **never trusted for final shippable creative**. The 75% self-produced target is real human labor by the founder, not a pipeline of unedited AI output. This matters both for quality and for the App Store editorial story — Apple's Kids category increasingly scrutinizes generative content.

### Pipeline cadence

Per scenario, targeting MVP's five hand-authored scenarios:

| Stage | Output | Founder time | Contractor time |
|---|---|---|---|
| Concept + storyboard | 1-page brief, scene moodboards | 4–6 hr | — |
| Narrative draft | Ink script v1 | 6–10 hr | — |
| Graybox scene | Walkable 3D placeholder | 6–10 hr | — |
| Placeholder VO + assets | Self-narrated, AI/library-sourced | 4–6 hr | — |
| Internal playtest | Notes, revisions | 4–8 hr | — |
| **Hero asset commission** | Animated characters | — | 1–2 weeks elapsed |
| Polish pass | Real audio, real lighting | 12–20 hr | — |
| External playtest | 3–5 family beta testers | 6–10 hr | — |
| Final VO + score | Shippable audio | — | 1 week elapsed |
| Final QA + cert prep | Store-ready | 8–12 hr | — |

**Realistic cadence: one polished scenario per ~3 weeks of focused founder time.** Five scenarios in ~15 weeks plus ~3 weeks of hero-asset contract turnaround = ~4 months for the MVP scenario set, parallelizable with platform / engine / store work.

---

## 4. Market Positioning & Competitive Landscape

### Reference set

| Competitor | Model | Price | Audience | What we learn from them |
|---|---|---|---|---|
| **ABCmouse** | Digital-only library, broad early-childhood curriculum | $12.99/mo (often discounted to ~$45/yr) | 2–8 yo | Pricing anchor for "fully digital education subscription"; family-comfortable price point. Curriculum breadth is moat we don't try to match |
| **Khan Academy Kids** | Free, ad-free, foundation-funded | Free | 2–8 yo | Sets the "free baseline" expectation in the category |
| **CrunchLabs Build Box** | Monthly physical kit + video tutorials + app, founded by Mark Rober | $34.99/mo | 8–13 yo | Hybrid format precedent; YouTube-creator-led marketing; expects parent + kid joint use |
| **Camp CrunchLabs** (referenced) | Weekly subscription variant | Higher | Same | Higher cadence model; different fulfillment pattern |
| **KiwiCo (Tinker / Atlas / Doodle Crates)** | Monthly kit, age-tiered, more open-ended | $25–40/mo | 0–14 yo across crate lines | The well-trodden indie-friendly hybrid model; manufacturing scale we should avoid mirroring early |
| **Nintendo Labo** | One-time hybrid (cardboard + Switch software) | $70–80 per kit | 6–12 yo | Cautionary tale: ambitious hybrid hardware + software, didn't sustain. Lesson: **subscription cadence + reusable items beat one-shot kits** |
| **iNaturalist Seek** | Free, community-driven species ID app | Free | All ages, but tween-friendly | Closest "outdoor + identification" app; no narrative, no progression, no parent-coplay design — leaves clear room |

### Where Biotope sits

Not a head-on competitor to any of these. The differentiated position is **the only mobile app explicitly built around alternating screen and outdoor activity, with a parent + child play model and a place-based content loop**.

- ABCmouse owns indoor-screen early-childhood breadth → we don't try to replace it.
- KiwiCo / CrunchLabs own monthly STEM-kit-led learning → we adopt the format but invert the primary surface (digital-led, kit-supplemental).
- iNaturalist owns adult / older-teen outdoor identification → we sit upstream as the family on-ramp.

### Differentiators (in order of strength)

1. **Place-based content** — the same scenario plays differently in San Diego vs Seattle vs Atlanta because content reads the player's location, season, and time of day. None of the reference set does this.
2. **Outdoor activity is gating, not optional** — completion requires real-world fieldwork. This is the product's spine, not a side feature.
3. **Parent + child as a first-class play mode** — not "kid plays alone, parent supervises"; both have differentiated UI and the parent has a coaching track.
4. **Founder credibility on the hybrid format specifically** — toy-to-life patent and prior shipped product (Prizm Labs); this is reportable and differentiating in press / App Store editorial / partnership conversations.
5. **Lifelong-learning bridge** — the underlying engine extends from 5-year-old's bird-spotting to 30-year-old's Research Station scenario. The 5–12 audience entered today becomes the 13–17 audience tomorrow on the same platform.

### Anti-positioning

What Biotope is **not**:

- Not a curriculum-replacement tool. Schools are a long-term partnership lane, not the MVP buyer.
- Not an identification app. iNaturalist is better at it; we don't compete on species count.
- Not a STEM-kit company. The kit is supplemental; the digital is primary.
- Not edutainment-as-distraction. The product *requires* the parent's involvement under 8 and the field activity under all conditions. That's a feature, not a bug, and the marketing should embrace it.

---

## 5. Monetization Strategy

### Tier structure

Three tiers in a freemium funnel:

#### Free (always free)

- **Sandbox / scenario tester** — explore 3D scenes; tap any species to learn one fact. No narrative, no progression. Demo of the engine.
- **Three always-free scenarios** — *Window Watch*, one urban-friendly scenario (no yard required), one seasonal teaser that rotates quarterly (so returning players see something new).
- **One region pack** — the player's current locality.
- **Field activity logging** for personal use.
- **No ads, ever.** This is non-negotiable for a kids' app and aligns with Apple Kids / Google Designed for Families policy.

**Purpose:** lowest possible barrier to first play; demonstrate the loop; convert ~3–8% to paid within 30 days.

#### Digital Subscription (~$9.99/mo or $79.99/yr)

- Everything in Free.
- **All digital scenario packs unlocked** as released — target 2–4 new scenarios per month after launch.
- **All region packs.**
- **Family sharing** up to 4 child profiles + 2 parent profiles on one subscription.
- **Mod loading** (post-MVP, when UGC opens).
- **Annual pricing 33% off monthly** — anchor habit-forming behavior, improve LTV.

**Pricing rationale:** $9.99/mo undercuts ABCmouse's $12.99 by ~25% — enough to be felt at the comparison-shopping stage without signaling cheapness. Annual at $79.99 (33% effective discount) is in line with ABCmouse's ~$45/year promo cadence but at a more sustainable margin.

**Target metrics:** 3–5% Free→Digital conversion within 30 days; 8–12% within 90 days; first-month retention >60%; six-month retention >35%.

#### Hybrid Subscription (~$24.99/mo or $249/yr)

- Everything in Digital Subscription.
- **Quarterly physical kit** of low-cost reusable components, mailed to the household (4 shipments/year).
- **Kit-required scenarios** — additional scenarios that gate on possession of specific kit items (e.g., "use your loupe to identify these three insects").
- **First kit ships with onboarding pack** — parent guide, sticker book, first scenario walkthrough card.

**Pricing rationale:** Hybrid sits between KiwiCo ($25–40) and CrunchLabs ($34.99) — at the low end because kit shipments are quarterly (not monthly) and items are reusable across scenarios (not consumables). Lower cadence + reuse = lower COGS = lower price. The unit economics anchor on $24.99/mo / 4 quarterly kits = ~$75/kit retail value.

**Target metrics:** 1–2% Free→Hybrid conversion within 90 days; 12-month retention >55% (kit subscribers retain better than digital-only — physical mail is a habit reinforcer).

### Family plans / tier mechanics

- One subscription covers the whole household (multiple kid profiles).
- **Cross-tier upgrade is one-tap** — a Digital subscriber can upgrade to Hybrid mid-cycle, prorated.
- **Annual prepayment discount** is the conversion lever for both tiers.
- **Pause subscription** (not cancel) for up to 3 months — important for hybrid (summer travel, winter break).

### What's deliberately NOT monetized

- **No microtransactions, ever.** No coins, no gems, no per-scenario purchases. This is a kids' app; the App Store editorial team and parent-buyer perception both reward this absolutely.
- **No ads** at any tier.
- **No data sale.** Privacy is a brand pillar, not a profit center.

---

## 6. Scenario Packaging

### Free scenarios (always available)

1. **Window Watch** — the universal first scenario; ~10 min total; works from a window seat anywhere.
2. **Sidewalk Plants** — urban-friendly; uses concrete-edge weeds and sidewalk trees; works for kids without yards.
3. **Seasonal teaser (rotates quarterly)** — *First Frost*, *Spring Buds*, *Summer Insects*, *Autumn Migration* — one is always live; rotates four times a year. Returning free players always see something new.
4. **Sandbox** — no narrative; explore species library + 3D dioramas.

The free tier is **complete in itself** — a player who never pays gets a real product. This is the App Store / Play editorial story and the parent-trust foundation.

### Digital Subscription packs (released regularly)

Each pack is a themed bundle of 3–5 scenarios sharing a domain. Released roughly monthly post-launch.

| Pack | Scenarios | Domain |
|---|---|---|
| **Backyard Birds** | *Backyard Bird Hour*, *Whose Song?*, *Feeder Friends*, *Migration Watch* | Bird ID, song recognition, behavior |
| **Pond & Stream** | *Pond Window*, *Tadpole Days*, *Stream Detectives*, *Dragonfly Hunt* | Aquatic life, life cycles |
| **Trees & Leaves** | *Leaf Detective*, *Bark Stories*, *Year of One Tree*, *Seed Collectors* | Botany, phenology |
| **Backyard Insects** | *Bug Hotel Builders*, *Pollinator Patrol*, *Worm Underground*, *Spider Architects* | Invertebrates, ecology |
| **Mammal Tracks** | *Whose Tracks?*, *Squirrel's Day*, *Deer Sign*, *Night Visitors* | Mammals, sign reading |
| **Seasonal limited-time** | 2–3 scenarios per season | Phenology + cultural seasonal hooks |

Cadence target after launch: **2–4 new scenarios per month**; one new pack per 1–2 months.

### Hybrid Subscription packs (require kit)

The kit ships quarterly. Each shipment adds 1–2 new tools and unlocks 1–2 corresponding scenario packs. Over a year, the household accumulates the full base toolkit.

| Quarter | Kit shipment | Hybrid-only pack(s) | Scenarios |
|---|---|---|---|
| **Q1** (onboarding) | Magnifier loupe + observation jar set + parent guide + sticker book | *Magnifier Mysteries* | 3 scenarios using loupe + jar |
| **Q2** | Rain gauge + thermometer + wind sock | *Weather Watcher* | 3 scenarios using weather instruments |
| **Q3** | Soil pH strips + sample scoops + pH chart | *Soil Detective* | 3 scenarios using soil tools |
| **Q4** | Specimen bags + pond net + waterproof field journal | *Pond Biologist* | 3 scenarios using collection tools |
| **Y2 Q1** | Constellation card + red flashlight + lunar calendar | *Star & Moon* | 3 night-sky scenarios |
| **Y2 Q2+** | Optional Arduino-based "Junior Research Station" sensor kit (12+) | *Backyard Data Logger* | Bridges into the embedded systems / RC vehicle scenarios from the v3 design |

Design principles for the kit:

- **Reusable.** Loupe, jar, gauge, thermometer — these stay in the household for years. Nothing single-use.
- **Low cost per item.** Target landed cost per quarterly kit < $8 to support $24.99/mo pricing with healthy margin.
- **Durable.** Survives a 7-year-old.
- **Branded but not branded-up.** Subtle — the items should feel like real tools, not toy versions.
- **No batteries required for first 4 quarters.** Mail-friendly, customs-friendly, kid-safe.
- **Each shipment unlocks new scenarios; older items stay relevant** — Q3 soil scenarios still use Q1's loupe and Q2's thermometer.

The hybrid tier upgrade ladder: the **Junior Research Station** Arduino kit at Y2+ is the bridge into the embedded-systems / RC-vehicle scenarios from the v3 design. This is how the platform follows the 5-year-old player into their teens.

### Cross-tier upgrade paths

- Free player who hits free-tier ceiling → "Try Digital free for 7 days" prompt at the natural break (after completing all free scenarios).
- Digital subscriber who completes a hybrid-flavored scenario in graybox demo → "Get the kit" upgrade prompt with quarterly cadence preview.
- Hybrid subscriber → no upsell; this is the top tier. Retention is the metric.

---

## 7. User Acquisition Strategy

### Channel ladder

Organic-first, paid second. The order matters: organic establishes the funnel; paid scales it.

#### Phase A — Organic foundation (months -6 to +6)

1. **Founder content marketing.** Lights Out Games blog + Substack: weekly long-form on the intersection of permaculture, family tech, ecology pedagogy, and indie game-dev. Founder's actual voice and credentials. Cross-post selectively to Hacker News / Lobste.rs / r/Permaculture / r/Homestead / r/Solarpunk.
2. **YouTube / TikTok / Instagram Reels.** Specific format: "5-year-old + tablet + backyard" — the visual is the marketing. Mike's modular synth and LED-art aesthetic translates well to short-form video. Target 1–2 produced shorts per week, not high cadence.
3. **Permaculture + homeschool communities.** Permaculture Design Certificate gives Mike standing in /r/Permaculture, Permies.com, regional permaculture guilds. The Wild + Free / homeschool-co-op networks are organized, evangelistic, and underserved by mainstream ed-tech.
4. **Indie game / solarpunk niche press.** Rock Paper Shotgun, Indie Game Plus, Solarpunk Magazine, The Verge games desk. The angle is "ex-toy-to-life founder ships ecology app" — narrative-driven press.
5. **App Store editorial.** Apple's Today / Kids categories are still the highest-leverage discovery surface. The asset bar is high; one strong submission (with paid creative) is worth dozens of paid ad campaigns. Mike's existing relationships from Scopely, AppsFlyer, Super Jump Games help here.
6. **Parks, museums, nature-center partnerships.** Low CAC, high brand alignment. Permaculture / ecology credentials open doors that game-marketer credentials don't. LA-area pilot: Theodore Payne Foundation, Kidspace, Eaton Canyon Nature Center, LA Audubon.
7. **Family-tech newsletters.** Common Sense Media reviews, Geek Mom, Tinkergarten newsletter, Wonderschool blog.

#### Phase B — Paid acquisition (months +6 onward)

Only after organic CAC and 30-day retention are stable.

1. **Apple Search Ads** for App Store keywords (`nature app for kids`, `outdoor activities kids`, etc.). Highly attributable. Cap monthly spend at organic-funded budget; never out-spend the organic top-of-funnel.
2. **Meta (Facebook + Instagram)** to lookalike audiences seeded from existing subscribers. Mike's mParticle / AppsFlyer background means proper attribution from day one.
3. **TikTok ads** if organic Reels prove the format. Lower priority — uncertain attribution for kids' apps.
4. **Influencer partnerships** with family / homeschool / outdoors-with-kids creators. Performance-based where possible.

### Founder narrative in marketing

The founder story is differentiated content. Use it.

- **Long-form intro post / video** at launch: "Why I'm building Biotope." Hits the toy-to-life patent + permaculture + parent + indie history.
- **Podcast circuit**: ed-tech, indie games, family-tech, solarpunk, permaculture podcasts. Long-form interviews convert well for adult buyers.
- **Press kit at launch** with the founder photo, the patent, the Prizm Labs history, the LA garden context.

Lead with biography for the first six months; lead with product after that.

### Referral mechanics

- **Family referral**: each subscriber gets a unique link; a referred household that converts to paid earns the referrer one month free. Caps to prevent gaming.
- **"Plant a seed"** — referrers can name a child profile in their referrals, giving the referrer a small social signal in-app.
- **Kid-to-kid referrals** are explicitly NOT a feature. Kids are not asked to refer kids; this is an adult-driven funnel.

### Geographic rollout

- **Soft launch:** one English-speaking, low-volume market for instrumentation. Recommended: New Zealand or Canada (English, App Store editorial-friendly, smaller absolute volumes, less risk if there's a launch issue).
- **Primary launch:** US + UK + Australia at month +3. English-only at first.
- **Localization later:** Spanish (large US Hispanic market, Mexico, Spain), French (Canada), German. v1.1+ territory.

---

## 8. Lifecycle & Retention

### Onboarding

- First-run flow ≤ 5 minutes from install to first sim scene playing.
- Account creation deferred — first scenario can complete with no account.
- Account creation triggered at the natural moment of first save / first photo.
- COPPA-compliant consent: parent email verified before any kid data persists.

### Habit formation target

The retention model assumes **one parent-and-child session per week** is the sustainable cadence for the audience. Anything more is bonus; less and we churn.

- Weekly engagement notification: "Your local birds are most active right now" (location + time-of-year aware).
- Saturday morning is the highest-engagement window for the audience; lifecycle messaging targets it.

### Retention triggers

- New scenario release notifications (gentle; one per pack release).
- Seasonal phenology triggers ("the maples in your area are turning — check out *Year of One Tree*").
- Kit shipment notifications (hybrid tier) — physical mail itself is a habit anchor.
- Parent digest: weekly summary of what the kid noticed / photographed.

### Churn mitigation

- **Pause, don't cancel.** Pause-up-to-3-months retains data and reactivates without re-onboarding.
- **Annual reminder before renewal** with a personalized year-in-review (number of species spotted, hours outdoors, etc.). Anchor the value before the charge.
- **Win-back campaign** at +30 days post-cancel: offer 1-month free with a new seasonal scenario.

### LTV optimization

- Annual pricing is the largest LTV lever. Anchor the discount aggressively (33% off).
- Hybrid tier LTV is 2.5–3x Digital LTV at similar churn rates because of price + retention; aggressive promotion of the upgrade path matters.
- Family plans: a household with two kids retains meaningfully better than one.

---

## 9. Distribution & Logistics

### Digital distribution

- **iOS App Store** (primary) — Capacitor wrapper + native bridges for camera/GPS.
- **Google Play Store** — same wrapper; Designed for Families certification.
- **PWA at biotope.app** (or similar; check Lights Out Games domain consolidation) — desktop joiners, fallback for non-store countries.

Apple Kids Category and Google Designed for Families certifications are required from launch. Plan ~2 weeks for first review; expect rejection cycles. The MarTech / mParticle / AppsFlyer alumni network includes people who have shipped kids apps and can de-risk this.

### Hybrid kit fulfillment

Three-stage logistics evolution:

1. **Manual fulfillment** (first 100–250 subscribers): Mike personally packs and ships from home in LA. Quarterly cadence makes this physically feasible at this volume. Pros: total cost control, intimate customer feedback, photo opportunities for marketing. Cons: doesn't scale past a few hundred subscribers.
2. **Fulfilled-by-3PL** (250–2,500 subscribers): a small-batch fulfillment partner (ShipBob, ShipMonk, or a regional LA partner). Olaunch network has direct contacts. Quarterly cadence still works.
3. **Manufacturer-direct + 3PL** (2,500+): components manufactured in larger batches, kitted and shipped by 3PL. Approach this only after the first two stages prove unit economics.

Initial component sourcing: Olaunch supply-chain contacts; Aliexpress sample-and-validate for non-branded items; brand the field journal and the box (the two highest-perceived-value items) and source the rest plain.

**Initial geographic restriction for Hybrid:** US 50 states only at launch. International hybrid shipping is a complexity multiplier we defer.

---

## 10. Unit Economics (rough working numbers)

### Free tier

- **CAC**: $0 organic, $1–4 paid (Apple Search Ads).
- **Cost per active user per month**: ~$0.20–0.50 (mostly server + bandwidth).
- **Goal**: not money-positive directly; serves as the top of the funnel.

### Digital Subscription

- **Price**: $9.99/mo or $79.99/yr (avg ~$92/yr blended assuming 50/50 monthly/annual mix at year 1).
- **Apple/Google fee**: 30% year-1, 15% year-2+ for subscriptions.
- **Net to Lights Out Games** year-1: ~$6.99/mo monthly, ~$55.99/yr annual.
- **Server + bandwidth + content amortization** per active subscriber: ~$1–2/mo.
- **Gross margin**: 70–80%.
- **Target LTV at 9-month average tenure**: ~$60.
- **Target paid CAC**: <$15 to maintain 4:1 LTV:CAC.

### Hybrid Subscription

- **Price**: $24.99/mo or $249/yr.
- **App Store fee** does not apply to physical-good portion; only digital portion. Stripe / direct billing can be used for the physical fulfillment to avoid the app-store cut. **However**, this is App Store policy territory — Apple has historically been strict about routing physical-goods subscriptions; legal review needed before launch.
- **COGS per quarterly kit landed**: target $6–9 (components ~$4–5, packaging ~$1, shipping $2–3 within US).
- **Annual COGS per subscriber**: $24–36.
- **Net price annualized**: ~$249 - 0–30% platform fee (depending on routing) - $30 COGS = $145–185 contribution.
- **Gross margin**: 55–75% depending on platform routing.
- **Target LTV at 14-month average tenure**: ~$200–250.
- **Target paid CAC**: <$30.

### Sensitivity

- If Digital monthly→annual mix shifts to 70% annual, blended LTV jumps ~25%.
- If Hybrid quarterly cadence becomes monthly (a future option), price goes to ~$39.99/mo with ~$10/kit COGS — unit economics at parity but customer commitment harder.
- If App Store small-business reduced fee (15%) applies year-1 (qualifying revenue threshold), Digital margin improves ~15 points immediately.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo developer burnout | High | Project-ending | Strict scope discipline (the MVP doc is the contract); one full week off per quarter; quarterly contractor retainer to absorb production crunches |
| Asset production bottleneck despite 75% target | High | Delays launch | AI-augmented dev pipeline; pre-commit hero animation contracts; OSS asset library cataloged before scenario authoring begins |
| Hybrid kit fulfillment complexity | Medium | Margin compression + customer service load | Manual fulfillment until 100+ subscribers prove demand; Olaunch network for sourcing; defer hybrid until Digital stable |
| COPPA / GDPR-K compliance miss | Medium | App-store removal, legal exposure | Legal review of policy + ToS before launch; default-private architecture; opt-in-only sharing |
| App Store kids-category rejection | Medium | Launch delay | Family-tech network has shipped-kids-app experience; pre-submission review; soft launch in lower-stakes geography |
| Subscription churn typical of ed-tech (5–8%/mo) | High | LTV erosion | Annual pricing emphasis; pause-don't-cancel UX; seasonal content cadence; hybrid tier physical mail as habit anchor |
| Apple's App Store policy changes around external billing for physical goods | Medium | Hybrid economics at risk | Multi-track legal exploration; willingness to take 30% on hybrid if needed (still margin-positive) |
| Permaculture / ecology audience doesn't convert at expected rate | Medium | Slower top-of-funnel | Have parallel homeschool / family-tech channel; don't bet entire acquisition strategy on permaculture |
| Founder distracted by 6sense day-job | Medium | Slow shipping | Time-boxed evening + weekend cadence; quarterly "burst" weeks of PTO; hire a part-time producer/PM at first revenue |
| Children's content trust violation (a creator says something inappropriate, a photo gets shared by mistake) | Low | Brand-ending | Default-private architecture; no UGC at MVP; legal-reviewed content policy; founder personal review of every shipped scenario |

---

## 12. Roadmap

| Phase | Months | Focus | Tier(s) live |
|---|---|---|---|
| **Pre-launch** | -6 to 0 | Content seeding, waitlist, 3 alpha scenarios, App Store cert prep | None public |
| **Soft launch** | +1 to +3 | One geography (NZ or CA); free tier; instrumentation | Free |
| **Digital launch** | +4 to +6 | US/UK/AU expansion; Digital Subscription added | Free, Digital |
| **Hybrid pilot** | +7 to +12 | LA-area only; 100–250 subscribers; manual fulfillment | Free, Digital, Hybrid (regional) |
| **Hybrid expansion** | +13 to +18 | US-wide hybrid; 3PL partner; localized to ES + FR | Free, Digital, Hybrid (national) |
| **Adult bridge** | +19 to +24 | Junior Research Station (Arduino) kit; first 13–17 scenarios; UGC alpha | All tiers + UGC alpha |
| **Platform expansion** | +25+ | B-1 (Steam + Steam Deck); embedded systems; eventual B-2 evaluation | Multi-platform |

Twelve months to full hybrid; 24 months to the bridge into the older audience. Both deliberately conservative for a solo operator.

---

## 13. Open Questions / Next Steps

1. **Lights Out Games branding**: does Biotope ship as a sub-brand under Lights Out Games, or rebrand the studio? Check existing studio brand equity, domains, social handles.
2. **Patent leverage**: the toy-to-life patent — actively license, defensively hold, or feature in marketing? Legal call before disclosure decisions.
3. **Apple physical-goods subscription routing**: legal/operational determination on whether the hybrid sub goes through App Store (30%/15% fee) or external billing for the physical portion. This is the single biggest unit-economics question.
4. **Soft-launch geography pick**: NZ vs Canada vs Australia. Lean Canada for proximity + currency + size + App Store editorial relationships.
5. **First-kit component sourcing**: Olaunch network outreach to confirm $6–9 landed-cost target is achievable with the proposed Q1 components.
6. **Voice talent search**: identify and audition 3–5 candidate parent-narrators in LA before MVP scenarios are voiced.
7. **Hero animation contractor**: identify and contract one senior 3D animator from the Super Jump Games / ex-EA-THQ-Kabam network for the bird, squirrel, and frog characters; book a 4–6 week window.
8. **Children's UX consultant engagement**: book a 20-hour engagement before MVP scenarios are finalized.
9. **Legal counsel engagement**: COPPA / privacy / ToS / patent + IP review. Flat-rate engagement with LA tech-startup counsel.
10. **Content cadence from launch**: confirm the realistic post-launch scenario release cadence (target 2–4/month) is sustainable with the asset pipeline before promising it in marketing.
11. **Permaculture / homeschool community evangelism plan**: who specifically does Mike reach out to first? List the 20 people / organizations with personal warm intros.
12. **Founder bandwidth model**: how many hours per week through pre-launch? After launch? Honest answer affects every timeline above.

---

*Default recommendation:* execute Pre-launch and Soft launch phases as described; **decide on the App Store hybrid-sub routing question before committing to Hybrid pilot timing**, because that single legal/operational answer shifts Hybrid economics by 15–30 margin points. Everything downstream is downstream of that.
