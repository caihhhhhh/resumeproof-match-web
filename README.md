# ResumeProof Match

Evidence-first resume and job-description matching. ResumeProof Match checks role requirements against verifiable resume excerpts, explains gaps, and lets the user approve every rewrite before exporting a new resume.

[Try the live website](https://resumeproof.szw19990924.chatgpt.site/?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) · [中文说明](README.zh-CN.md) · [Related AI-agent skill](https://github.com/caihhhhhh/resume-proof-match)

![ResumeProof Match](public/og.png)

## What it does

- Accepts PDF, DOCX, TXT, Markdown, PNG, JPG, and WebP resumes or job descriptions.
- Reads supported job links and falls back to reviewed pasted text when a source blocks reliable extraction.
- Uses semantic analysis instead of keyword-only matching.
- Separates role fit, evidence coverage, and resume expression.
- Cites the resume excerpt behind each supported requirement.
- Produces proposed rewrites with reasons; no suggestion is applied automatically.
- Provides a structured full-text editor, three layouts, and HTML, PDF, or DOCX export.
- Includes optional OCR, bilingual UI, privacy controls, GA4 funnel analytics, and a private admin dashboard.

## Product flow

```text
Resume + JD
    ↓ review extracted text
Evidence-based match
    ↓ accept, reject, or edit suggestions
Full-text approval
    ↓ choose a layout
HTML / PDF / DOCX
```

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. AI analysis and OCR require server-side keys; the interface and demo route can still be inspected without placing secrets in client code.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Canonical production origin |
| `DEEPSEEK_API_KEY` | Server-side semantic matching |
| `DEEPSEEK_MODEL` | Matching model, default `deepseek-v4-flash` |
| `ZHIPU_API_KEY` | Server-side OCR and visual reading |
| `ZHIPU_VISION_MODEL` | Vision model, default `glm-4.6v-flash` |
| `ADMIN_EMAILS` | Lowercase admin email allowlist |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional GA4 web stream ID |
| `GA4_PROPERTY_ID` | Optional GA4 reporting property |
| `GA4_SERVICE_ACCOUNT_EMAIL` | Optional GA4 reporting identity |
| `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` | Optional GA4 reporting private key |

Copy `.env.example`; never commit `.env.local`, API keys, service-account JSON, or real resumes.

## Quality checks

```bash
npm run lint
npm run build
```

## Privacy and limitations

Files are parsed in the browser where possible. Resume and JD text is sent to the configured AI provider only after the user starts analysis; scanned documents may be sent to the configured vision provider. AI output is advisory and must be reviewed. See the live [privacy page](https://resumeproof.szw19990924.chatgpt.site/privacy?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609).

Do not open an issue containing a resume, job application, API key, or other personal information. See [SECURITY.md](SECURITY.md).

## Documentation

- [GA4 admin setup (Chinese)](docs/ga4-admin-setup.zh-CN.md)
- [UTM channel playbook (Chinese)](docs/utm-channel-playbook.zh-CN.md)

## License

[MIT](LICENSE)
