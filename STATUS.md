# RDU HeatWave - Project Status

## Live
- **URL**: https://rduheatwave.team (Vercel, SSL)
- **Repo**: https://github.com/willsigmon/RDUHeatWave (private)
- **Domain**: Namecheap (cvhelms account) -> Vercel DNS
- **Email**: rduheatwave.team

## DNS Records (Namecheap Advanced DNS)
- A Record: `@` -> `76.76.21.21`
- CNAME: `www` -> `cname.vercel-dns.com.`

## Done
- [x] Custom HTML form with flame animations, countdown timer
- [x] Deployed to Vercel (auto from `vercel --yes --prod`)
- [x] rduheatwave.team pointed to Vercel
- [x] Meeting day set to Thursday 11:30 AM ET
- [x] Button says "CHECK IN"
- [x] Perplexity branding removed
- [x] Logo sharpened (160px, crisp-edges)
- [x] Clouds Brewing section with logo + full 17-beer tap list
- [x] GitHub repo synced
- [x] Printable meeting agenda (agenda.html) with worksheets
- [x] Meeting lobby page (meet.html) with QR code
- [x] Repo renamed: rduheat -> RDUHeatWave
- [x] README, CLAUDE.md, brand guide, meeting structure docs added
- [x] Context from 212-website and two-twelve repos consolidated
- [x] Sweep fix: agenda route restored, meeting time corrected to 11:30 AM ET, countdown made DST-safe
- [x] Sweep fix: guest-of validation, local-only submit messaging, and kiosk audio hardening
- [x] Google Apps Script deployed and wired to production form
- [x] Same-origin Vercel form proxy added so check-ins get real success/failure instead of `no-cors` false positives
- [x] Form hardened with timeouts, origin checks, burst/hourly throttling, bounded local backup, a hidden honeypot, and cleaner API error handling
- [x] Clouds Brewing logo pulled local; favicon/theme-color metadata added across pages
- [x] SEO/PWA polish added: canonical tags, Open Graph/Twitter cards, robots.txt, sitemap.xml, site.webmanifest, and app icons
- [x] Security headers added through Vercel route policy
- [x] Meeting lobby overlay made keyboard-accessible for kiosk start/audio enable
- [x] Owned intake spreadsheet created for live submissions because the original team sheet was inaccessible to the deployment account

## TODO
- [ ] **Migrate form backend to the original team sheet once access is approved**
  - Current live intake sheet: `1kO0bk-89QLOI71ZqZkrGK50phvJfq6TxnGdHGIFt3qk`
  - Original requested team sheet: `1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M`
  - Current live web app URL: `https://script.google.com/macros/s/AKfycbzrs6C9Ts3KyJKksOBKLuQ8zl9u0VB8fQbsdnVy463PdGs1tzr02ursWMqcSJJ7BjnQtA/exec`
- [ ] Countdown centering may still be slightly off -- verify on mobile
- [ ] Logo could be replaced with higher-res PNG source if available
- [ ] Change Namecheap password (was shared in chat)

## Venue
- **Clouds Brewing** -- 1233 Front St, Raleigh NC (side room, special deal)
- Beer list from cloudsbrewing.com, subject to change

## Deploy Command
```bash
cd "/Users/wsig/GitHub MBA/RDUHeatWave"
vercel --yes --prod
```
