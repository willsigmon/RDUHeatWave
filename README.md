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
| `/agenda.html` | Printable meeting agenda with worksheets |

## Meeting Details

- **Day**: Thursdays
- **Time**: 11:30 AM ET
- **Venue**: Clouds Brewing, 1233 Front St, Raleigh NC (side room)
- **Contact**: rduheatwave.team

## Tech Stack

- Static HTML/CSS/JS (no framework)
- Vercel (hosting + SSL)
- Google Apps Script (form -> Google Sheets)
- Namecheap (domain DNS)

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
cd "/Volumes/Ext-code/GitHub Repos/RDUHeatWave"
vercel --yes --prod
```

## Google Sheets Integration

- **Sheet ID**: `1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M`
- **Apps Script**: Deploy `apps-script.js` to script.google.com as Web App
- Form submissions write: Timestamp, First Name, Last Name, Profession, Phone, Email, Guest Of
