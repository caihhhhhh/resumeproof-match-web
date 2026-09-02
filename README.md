# ResumeProof Match

## See whether your resume fits the job — and the evidence behind the answer.

ResumeProof Match compares every job requirement with verifiable resume excerpts, explains the gaps, and lets you approve every edit before exporting a new resume.

**[Match a resume to a job on the live website →](https://resumeproof.szw19990924.chatgpt.site/match/new?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)**

Prefer to look around first? [Open the complete example](https://resumeproof.szw19990924.chatgpt.site/match/new?demo=1&utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609). No files needed.

[中文说明](README.zh-CN.md) · [Matching guide](https://resumeproof.szw19990924.chatgpt.site/en/guide?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) · [AI-agent skill](https://github.com/caihhhhhh/resume-proof-match) · [Privacy](https://resumeproof.szw19990924.chatgpt.site/privacy?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)

![ResumeProof Match](public/og.png)

## Why use the website

- **See why something matches.** Every supported requirement points back to a resume excerpt.
- **Find real gaps, not missing keywords.** Semantic analysis recognizes equivalent wording and transferable experience.
- **Keep control of the rewrite.** Accept, reject, or edit each suggestion before it reaches the final draft.
- **Finish in one flow.** Review the complete text, choose a layout, and export HTML, PDF, or DOCX.

Upload PDF, DOCX, TXT, Markdown, PNG, JPG, or WebP files, paste text, or provide a supported job link. OCR, bilingual UI, privacy controls, GA4 funnel analytics, and a private admin dashboard are also included.

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

## Use it your way

| Goal | Best route |
| --- | --- |
| Match a resume now | [Use the live website](https://resumeproof.szw19990924.chatgpt.site/match/new?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) |
| Inspect the full flow without uploading | [Load the complete example](https://resumeproof.szw19990924.chatgpt.site/match/new?demo=1&utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) |
| Run your own isolated instance | Follow the setup below and [deployment guide](docs/deployment.md) |
| Use the method inside an AI agent | Install the [ResumeProof Match skill](https://github.com/caihhhhhh/resume-proof-match) |

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm ci
npm run setup
npm run doctor
npm run dev
```

Open `http://localhost:3000`. The setup command creates local configuration without overwriting existing files. The doctor reports which capabilities are ready without printing secret values. The interface and built-in example work before AI keys are added.

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

- [Self-hosting and deployment](docs/deployment.md)
- [自行部署指南](docs/deployment.zh-CN.md)
- [GA4 admin setup (Chinese)](docs/ga4-admin-setup.zh-CN.md)
- [UTM channel playbook (Chinese)](docs/utm-channel-playbook.zh-CN.md)

## License

[MIT](LICENSE)
