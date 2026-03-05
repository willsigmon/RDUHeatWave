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

## TODO
- [ ] **Google Apps Script** -- deploy `apps-script.js` to script.google.com
  - Sheet ID: `1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M`
  - Deploy as Web App -> Execute as Me -> Access: Anyone
  - Paste the URL into `index.html` line ~1018 (replace `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE`)
  - Then `vercel --yes --prod` to redeploy
- [ ] Countdown centering may still be slightly off -- verify on mobile
- [ ] Logo could be replaced with higher-res PNG source if available
- [ ] Change Namecheap password (was shared in chat)

## Venue
- **Clouds Brewing** -- 1233 Front St, Raleigh NC (side room, special deal)
- Beer list from cloudsbrewing.com, subject to change

## Deploy Command
```bash
cd "/Volumes/Ext-code/GitHub Repos/RDUHeatWave"
vercel --yes --prod
```
