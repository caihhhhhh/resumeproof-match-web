# Self-hosting and deployment

This repository contains the complete application code, but it intentionally excludes the original operator's credentials, analytics data, stored samples, and deployment identity. A self-hosted copy provides the same product flow with isolated data after its own providers are configured.

## Capability levels

| Configuration | Available experience |
| --- | --- |
| No provider keys | Interface, bilingual copy, local file reading, and built-in example |
| `DEEPSEEK_API_KEY` | Live semantic resume-JD analysis and rewrite suggestions |
| `ZHIPU_API_KEY` | OCR for images and scanned PDFs |
| Sites project with D1 | Runtime metrics, feedback, optional redacted samples, and admin data |
| GA4 web stream | Browser funnel events |
| GA4 reporting credentials | GA4 reports inside the private admin dashboard |

## 1. Start locally

```bash
git clone https://github.com/caihhhhhh/resumeproof-match-web.git
cd resumeproof-match-web
npm ci
npm run setup
npm run doctor
npm run dev
```

Open `http://localhost:3000`. `npm run setup` creates `.env.local` and `.openai/hosting.json` only when they do not already exist.

## 2. Enable live AI features

Edit `.env.local` and add server-side credentials:

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash

ZHIPU_API_KEY=
ZHIPU_VISION_MODEL=glm-4.6v-flash
```

Run `npm run doctor` again. It reports readiness without printing any credential value.

## 3. Configure a Sites deployment

This codebase uses Vinext, the Sites Vite plugin, and a Cloudflare-compatible D1 binding. Create your own Sites project, then replace the placeholder values in `.openai/hosting.json` with that project's configuration. Do not reuse another operator's project ID.

The application creates its required D1 tables and indexes with `CREATE TABLE IF NOT EXISTS` when the related features first run. The SQL files in `drizzle/` remain available for review or manual administration.

Add production secrets through the deployment environment rather than committing them. At minimum, a fully functional public matcher needs:

- `SITE_URL`
- `DEEPSEEK_API_KEY`
- `ZHIPU_API_KEY` when OCR is enabled

The current admin authentication reads the identity headers provided by Sites. Set `ADMIN_EMAILS` to a comma-separated lowercase allowlist. Deploying on a different platform requires replacing this authentication adapter and supplying an equivalent database binding.

## 4. Optional analytics

Browser events require `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Reading GA4 reports inside `/admin` additionally requires:

- `GA4_PROPERTY_ID`
- `GA4_SERVICE_ACCOUNT_EMAIL`
- `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`

Grant the service account access only to the intended GA4 property. See [GA4 admin setup](ga4-admin-setup.zh-CN.md).

## 5. Verify before publishing

```bash
npm run doctor
npm run lint
npm run build
```

Then verify the built-in example, a text-based PDF, a scanned image if OCR is enabled, one real AI analysis, export, privacy pages, and admin access.

## Security boundary

Never commit `.env.local`, `.openai/hosting.json`, service-account JSON, real resumes, or production logs. Each deployment owner is responsible for consent language, retention, provider terms, and local privacy requirements.
