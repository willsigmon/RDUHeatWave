# RDU HeatWave - Project Context

## What This Is

Static website for the RDU HeatWave team, a local chapter of 212 Referral Network based in Raleigh-Durham, NC. Live at https://rduheatwave.team.

## Architecture

Pure static HTML/CSS/JS deployed on Vercel. No framework, no build step.

### Pages
- `index.html` — Registration/check-in form (main landing page, catch-all route)
- `meet.html` — Meeting lobby kiosk (QR code, countdown, venue info)
- `agenda.html` — Printable meeting agenda (letter-size, 2-page layout)
- `apps-script.js` — Google Apps Script for form -> Google Sheets

### Routing (vercel.json)
- `/meet` -> `meet.html`
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
- **Serif**: Cormorant Garamond (agenda print only)

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
