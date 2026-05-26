# RDU HeatWave - Project Context

## What This Is

Static website for the RDU HeatWave team, a local chapter of 212 Referral Network based in Raleigh-Durham, NC. Live at https://rduheatwave.team.

## Architecture

Pure static HTML/CSS/JS deployed on Vercel. No framework, no build step.

### Pages
- `index.html` — Registration/check-in form (main landing page, catch-all route)
- `meet.html` — Meeting lobby kiosk (QR code, countdown, venue info)
- `agenda.html` — Paperless visitor agenda on screen, printable/admin agenda in print mode
- `apps-script.js` — Google Apps Script for form -> Google Sheets

### Routing (vercel.json)
- `/meet` -> `meet.html`
- `/agenda` -> `agenda.html` (visitor-friendly paperless agenda)
- `/agenda/admin` -> `agenda.html` (print/admin controls)
- `/agenda.html` -> `agenda.html`
- `/*` -> `index.html` (catch-all)

## Brand & Design System

### Colors
```
Primary:     #E8580C (fire orange)
Hover:       #FF6A1E
Active:      #C44A0A
Background:  #1a1412 (warm charcoal)
Surface:     #231c18
Surface 2:   #2c2420
Text:        #f0e6dc
Text Muted:  #a89585
Text Faint:  #6b5c4e
Success:     #5BA847
Error:       #D94444
Gold:        #8a6d3b (print/agenda)
```

### Typography
- **Display**: Bebas Neue (headings, countdown, buttons)
- **Body**: Plus Jakarta Sans (form labels, paragraphs)
- **Serif**: Cormorant Garamond (agenda print and agenda accent copy only)

### Design Language
- Dark theme with warm undertones (not cold/blue dark)
- Fire/heat particle animations (CSS-only, no JS libs)
- Heat shimmer lines across background
- Glowing orb behind main content
- Orange accent throughout, no secondary color
- Glass morphism avoided — solid surfaces with subtle borders

## 212 Referral Network Context

212 = the temperature at which water boils. The "extra degree" philosophy: going one degree beyond transforms everything.

### Key Concepts
- **GI (Gratitude Incentive)** — Points for referral activity, the core gamification metric
- **Steam Score** — Aggregate performance metric (referrals given + received + attendance)
- **BizChat** — Short 1-on-1 meetings between members outside of weekly meetings
- **Visitor** — A prospective member attending as someone's guest
- **The Extra Degree** — Brand philosophy: 211 is hot, 212 boils, that extra degree = steam = power

### Meeting Structure
1. Networking / open time
2. Welcome & mentor moment
3. Member introductions (30-second elevator pitches)
4. Referral round (who has referrals to give?)
5. Guest introductions
6. Closing

### Team Data
- **Google Sheet ID**: `1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M`
- **Tabs**: Team Stats, Attendance, Referrals, Applications
- **Sheet (212-website context)**: `1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA` (Team Stats 2026)

## Venue

**Clouds Brewing** — 1233 Front St, Raleigh NC 27609
- Side room, special deal for the group
- 17-tap beer list displayed on meet.html
- Logo displayed on lobby page

## Domain & Hosting

- **Domain**: rduheatwave.team (Namecheap, cvhelms account)
- **DNS**: A record @ -> 76.76.21.21, CNAME www -> cname.vercel-dns.com
- **Hosting**: Vercel (auto-deploy from repo)
- **Email**: rduheatwave.team domain

## Related Resources (Context Only)

These repos provided design/feature context but are NOT part of this codebase:
- `Will-Sigmon-Media-Company/212-website` — Next.js marketing site + dashboard with Google Sheets backend, NextAuth, steam gauge components
- `willsigmon/two-twelve` — Next.js member management app with Supabase, kiosk mode, QR attendance

### Brand Colors from 212-website (for reference)
```
brand-blue:     #6BCCF4
brand-green:    #6BBD45
brand-charcoal: #1E1E1E
brand-silver:   #C0C0C0
brand-gold:     #FFD700
brand-red:      #FF4444
```

## Development

No build step. Edit HTML files directly and deploy:
```bash
vercel --yes --prod
```

For the Google Apps Script, edit in script.google.com (Sheet ID in apps-script.js).

<!-- NOT_ANOTHER_AI_WEBSITE_DESIGN_BIBLE_START -->
## Global Design Bible: Not-Another-AI-Website

Default for all website/app UI design work unless the user gives a more specific art direction or an existing repo design system requires otherwise.

### Role
Act as a senior brand-led web designer + frontend engineer. Ship work that feels intentional, editorial, premium, and brand-specific — closer to MetaLab, Active Theory, Resn, Locomotive, or Awwwards SOTD than a default LLM template.

### Forbidden AI house style
Do not ship these unless explicitly requested:
- Inter, Geist, or system-ui as the headline font.
- Generic purple/blue/indigo gradient blobs.
- Dark glassmorphism heroes with backdrop-blur cards.
- 3-up feature grids with default Lucide icons in colored circles.
- Vercel-clone “Built with Next.js / Powered by AI” heroes.
- rounded-2xl everything and shadow-lg on every card.
- Generic grayscale “Trusted by” logo strips.
- Default Free / Pro / Enterprise pricing cards.
- Tailwind slate/zinc/neutral as the whole palette.
- Hero copy that starts “Build / Ship / Create [X] in seconds.”

### Required design process and output contract
For every proposed design, provide before or with the code:
1. Brand North Star — one sentence for the core feeling/message.
2. Reference Pull — use available design tools first; cite at least two visual references by name. Preferred when available: Mobbin, Magic / 21st.dev, shadcn primitives only, Aceternity when justified, Figma Dev Mode if a file exists, Lottie/Rive for motion beyond fades. If a required tool is unavailable, say so instead of guessing.
3. Design Tokens — JSON covering expressive typography, OKLCH color, 8pt spacing, one radius personality, motion tokens, and one texture choice.
4. Code.
5. Three bullets: “What makes this not look AI-generated.” If the design cannot be justified, redesign before shipping.

### Token defaults
If unspecified, use editorial-modern: expressive display serif mood (PP Editorial New / Tiempos / Migra / Domaine / Newsreader / similar), Söhne or personality grotesk mood for body, warm off-white background, oxblood accent, asymmetric grid, slow spring motion, subtle grain. If exact commercial fonts are unavailable, choose accessible equivalents with the same intent.

Token JSON shape:
```json
{
  "typography": {
    "display": "expressive foundry or strong Google/Fontshare alternative; not Inter/Geist",
    "body": "complementary sans or serif",
    "mono": "only if needed",
    "scale": "modular ratio"
  },
  "color": {
    "model": "OKLCH",
    "palette_strategy": "60/30/10 with one unexpected accent",
    "tokens": { "bg":"", "surface":"", "ink":"", "muted":"", "accent":"", "signal":"" }
  },
  "spacing": "8pt grid with t-shirt scale",
  "radius": "flat, soft, or pill — pick one personality",
  "motion": "spring/ease curves plus duration tokens",
  "texture": "grain / noise / paper / none — pick one"
}
```

### Execution rules
- Typography carries the design: tighten headlines, loosen all-caps eyebrows, use clamp() fluid type, real ligatures/stylistic sets, oldstyle figures where appropriate, and tabular nums for data.
- Layout should favor asymmetry, named CSS Grid areas, one hero move, and real content density instead of centered-stack sameness.
- Color should be OKLCH when possible, avoid pure black/white, honor 60/30/10, and use one unexpected accent sparingly.
- Motion should reveal hierarchy, use spring physics when practical, include reduced-motion support, and avoid decoration-only animation.
- Add one premium tell: subtle grain/paper/noise, duotone, custom cursor, kinetic marquee, horizontal scroll, sticky reveal, real photography, curated/custom icons, or a small delight moment.
- Build quality: Tailwind v4 CSS variables or vanilla CSS @layer; shadcn as unstyled primitives only; WCAG AA contrast; semantic HTML; keyboard nav; 44px touch targets; visible focus; self-host fonts and preload hero assets when practical; Lighthouse target >= 95.

### Vibe calibration
- Editorial: display serif, asymmetric grid, generous leading, photography-first.
- Brutalist: mono, hard edges, exposed grid lines, system colors, zero shadows.
- Swiss: Helvetica/Söhne mood, strict grid, red accent, ruthless hierarchy.
- Y2K/playful: chrome, intentional gradients, oversized cursor, sticker UI.
- Quiet luxury: off-white, oxblood/forest, serif, slow motion, negative space.
- Cyberpunk: mono, neon on near-black, scan lines, glitch micro-animations.
- Analog/craft: paper texture, hand-set type, irregular grid, warm palette.
<!-- NOT_ANOTHER_AI_WEBSITE_DESIGN_BIBLE_END -->
