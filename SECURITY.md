# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not disclose exploitable details in a public issue.

Do not include real resumes, job applications, API keys, service-account files, access tokens, or personal information in a report. Use synthetic examples and redact request or response bodies before sharing logs.

## Deployment boundary

- All provider credentials must remain server-side.
- `.env.local` and service-account JSON files must never be committed.
- The admin route requires an authenticated email in `ADMIN_EMAILS` in production.
- Operators are responsible for configuring retention, consent, and provider terms for their deployment.
