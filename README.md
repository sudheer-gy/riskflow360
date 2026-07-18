# RiskFlow360

**Canada–Mexico Supplier Risk Intelligence Platform**

RiskFlow360 helps Canadian buyers evaluate, score, monitor, and certify Mexico-based suppliers. It combines supplier risk scoring, on-site audit tracking, USMCA compliance documentation, early-warning alerts, and a proprietary CCBS certification program in one platform.

## Modules

- **Dashboard** — portfolio-wide risk overview, watchlist, and alerts
- **Suppliers** — supplier database with profiles, risk scoring, certifications, and documents
- **Audits** — on-site audit tracking with findings and corrective actions
- **USMCA Docs** — certificate-of-origin tracking and document retention
- **CCBS Program** — proprietary Canada-Certified Border Supplier certification tracking
- **Alerts** — automated early warnings for risk, expiring certs, and overdue actions
- **Risk Weights** — configurable risk model weighting per buyer profile
- **Roles** — Administrator, Auditor, and Canadian Client access levels

## Running locally

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

## Building for production

```bash
npm run build
```

Output goes to the `dist/` folder, ready to deploy to Vercel, Netlify, or any static host.

## Note on data

This build stores data in the browser (localStorage) for demonstration. Production deployment adds a real database and authentication.

---

© 2026 RiskFlow360
