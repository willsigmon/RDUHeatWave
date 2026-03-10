# RDU HeatWave

**The Raleigh-Durham chapter of 212 Referral Network** — a structured business networking group built on the "extra degree" philosophy.

> At 211 degrees, water is hot. At 212 degrees, it boils. That one extra degree makes all the difference.

## Live Site

**https://rduheatwave.team**

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Guest registration / check-in form with countdown timer |
| `/meet` | Meeting lobby display (kiosk mode) with QR code + venue info |
| `/timer` | Standalone countdown timer (defaults to 30 seconds) |
| `/agenda` | Printable meeting agenda shortcut |
| `/agenda.html` | Printable meeting agenda with worksheets |

## Meeting Details

- **Day**: Thursdays
- **Time**: 11:30 AM ET
- **Venue**: Clouds Brewing, 1233 Front St, Raleigh NC (side room)
- **Contact**: rduheatwave.team

## Tech Stack

- Static HTML/CSS/JS (no framework)
- Vercel (hosting + SSL + same-origin form proxy at `/api/checkin`)
- Google Apps Script (proxy target -> Google Sheets)
- Namecheap (domain DNS)
- SEO/PWA assets (`robots.txt`, `sitemap.xml`, `site.webmanifest`, touch icons)
- Security headers via `vercel.json` route policy

## Brand

- **Primary**: `#E8580C` (fire orange)
- **Hover**: `#FF6A1E`
- **Background**: `#1a1412` (warm dark)
- **Surface**: `#231c18`
- **Fonts**: Bebas Neue (display), Plus Jakarta Sans (body)
- **Theme**: Heat/fire/steam metaphors, dark mode, flame particle animations

## 212 Referral Network

212 is a referral-based business networking organization. Each local chapter (like RDU HeatWave) meets weekly. Members build trust, exchange referrals, and track "Gratitude Incentives" (GIs) — a gamified metric for referral activity.

### How It Works

1. **Weekly meetings** — structured agenda with mentor moments, referral rounds, and networking
2. **Guest visits** — prospects attend as guests before applying for membership
3. **Referral tracking** — members give and receive qualified referrals, tracked via Google Sheets
4. **GI scores** — Gratitude Incentive points measure engagement and referral quality

## Deploy

```bash
cd "/Users/wsig/GitHub MBA/RDUHeatWave"
vercel --yes --prod
```

Production smoke check after deploy:
- `/`
- `/meet`
- `/agenda`
- `/api/checkin`
- `/robots.txt`
- `/sitemap.xml`
- `/site.webmanifest`

## Google Sheets Integration

- **Form intake sheet ID**: `1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA`
- **Current web app URL**: `https://script.google.com/macros/s/AKfycbwvYv_BYJznuumdC51jP-P6RuYRRgK5MEONjUywvl322MbR1W1_nA1hZHcsSj5oLfzvoQ/exec`
- **Production form endpoint**: `/api/checkin` on `https://rduheatwave.team`
- **Form hardening**: hidden honeypot, origin allowlist, burst/hourly throttling, bounded local backup, server-side field-length validation, enum validation for select fields, and request timeouts
- **Apps Script**: Deploy `apps-script.js` to script.google.com as Web App
- **Destination Tab**: `Guest Check In`
- **Header strategy**: `apps-script.js` maps values by header name and auto-adds missing expected columns
- **Current check-in fields**: Timestamp, Meeting Date, First Name, Last Name, Profession, Company Name, Email, Phone, Guest Of, First Visit?, Interested in Learning More?, Best Contact Method, Ideal Referral
