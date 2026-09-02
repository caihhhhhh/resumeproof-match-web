# ResumeProof Match

## 先判断简历是否适合这个岗位，再看证据在哪里。

ResumeProof Match 会把 JD 要求与可核对的简历原句逐条对照，说明差距，并让你审核每一处改写后再导出新简历。

**[打开网站，开始匹配简历与 JD →](https://resumeproof.szw19990924.chatgpt.site/match/new?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)**

想先看完整效果？[直接打开示例](https://resumeproof.szw19990924.chatgpt.site/match/new?demo=1&utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)，不需要上传文件。

[English](README.md) · [配套 AI Agent Skill](https://github.com/caihhhhhh/resume-proof-match) · [隐私说明](https://resumeproof.szw19990924.chatgpt.site/privacy?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)

![ResumeProof Match](public/og.png)

## 为什么用网站

- **看到“为什么匹配”。** 每条成立的要求都会引用简历原句。
- **找真实差距，而不是只找缺失的关键词。** 语义分析可以识别同义表达和可迁移经验。
- **改不改由你决定。** 每条建议都可以采用、拒绝或继续编辑。
- **在同一条流程中完成。** 审核全文、选择版式，再导出 HTML、PDF 或 DOCX。

支持 PDF、DOCX、TXT、Markdown、PNG、JPG 和 WebP，也可以粘贴文字或提供可读取的职位链接。网站还包含 OCR、中英文界面、隐私控制、GA4 漏斗分析和私有管理后台。

## 使用流程

```text
简历 + JD
    ↓ 审核识别文字
基于证据的匹配报告
    ↓ 采用、拒绝或修改建议
全文审核
    ↓ 选择版式
HTML / PDF / DOCX
```

## 选择使用方式

| 你想做什么 | 建议方式 |
| --- | --- |
| 现在就匹配一份简历 | [直接使用在线网站](https://resumeproof.szw19990924.chatgpt.site/match/new?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) |
| 不上传文件，先看完整流程 | [加载完整示例](https://resumeproof.szw19990924.chatgpt.site/match/new?demo=1&utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609) |
| 运行一个数据隔离的自建版本 | 按照下方步骤和[部署指南](docs/deployment.zh-CN.md) |
| 在 AI Agent 中使用这套方法 | 安装 [ResumeProof Match Skill](https://github.com/caihhhhhh/resume-proof-match) |

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run setup
npm run doctor
npm run dev
```

打开 `http://localhost:3000`。初始化脚本不会覆盖已有配置；检查脚本只说明哪些能力已就绪，不会打印密钥。在没有配置 AI Key 前，也可以查看界面和完整示例。

环境变量说明见 [`.env.example`](.env.example)。不要提交 `.env.local`、API Key、服务账号 JSON 或真实简历。

## 本地验收

```bash
npm run lint
npm run build
```

## 隐私与边界

文件会尽可能先在浏览器中读取。用户主动开始分析后，简历与 JD 文字才会发送到已配置的 AI 服务；扫描文档可能发送到视觉识别服务。AI 结果只是辅助建议，必须由用户审核。详见在线[隐私说明](https://resumeproof.szw19990924.chatgpt.site/privacy?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609)。

请不要在 Issue 中上传简历、申请记录、API Key 或其他个人信息。安全报告方式见 [SECURITY.md](SECURITY.md)。

## 文档

- [自行部署指南](docs/deployment.zh-CN.md)
- [Self-hosting and deployment](docs/deployment.md)
- [GA4 后台配置](docs/ga4-admin-setup.zh-CN.md)
- [UTM 渠道管理手册](docs/utm-channel-playbook.zh-CN.md)

## 开源许可

[MIT](LICENSE)
