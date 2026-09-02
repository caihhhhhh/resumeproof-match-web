# 自行部署指南

这个仓库包含完整应用代码，但不会包含原站点管理者的 API Key、GA4 数据、已保存样本和部署身份。完成自己的服务配置后，可以得到相同的产品流程，但数据相互隔离。

## 功能与配置对照

| 已完成的配置 | 可用功能 |
| --- | --- |
| 不配置服务密钥 | 界面、中英文、本地文件读取和内置示例 |
| `DEEPSEEK_API_KEY` | 真实的简历与 JD 语义分析、改写建议 |
| `ZHIPU_API_KEY` | 图片和扫描 PDF 的 OCR |
| 带 D1 的 Sites 项目 | 运行指标、用户反馈、可选脱敏样本和后台数据 |
| GA4 网站数据流 | 前端漏斗事件 |
| GA4 报表凭据 | 在私有管理后台中读取 GA4 报表 |

## 1. 在本地启动

```bash
git clone https://github.com/caihhhhhh/resumeproof-match-web.git
cd resumeproof-match-web
npm ci
npm run setup
npm run doctor
npm run dev
```

打开 `http://localhost:3000`。`npm run setup` 只会在目标文件不存在时创建 `.env.local` 和 `.openai/hosting.json`，不会覆盖原配置。

## 2. 开启真实 AI 功能

编辑 `.env.local`，填入服务端密钥：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash

ZHIPU_API_KEY=
ZHIPU_VISION_MODEL=glm-4.6v-flash
```

再次运行 `npm run doctor`。它只会说明功能是否就绪，不会打印密钥内容。

## 3. 配置 Sites 部署

当前代码使用 Vinext、Sites Vite 插件和兼容 Cloudflare D1 的数据库绑定。请创建自己的 Sites 项目，再把 `.openai/hosting.json` 中的占位内容换成新项目配置。不要复用其他管理者的项目 ID。

相关功能首次运行时，程序会通过 `CREATE TABLE IF NOT EXISTS` 创建需要的 D1 表和索引。`drizzle/` 中的 SQL 仍可用于审查或手动管理。

生产环境密钥应通过部署环境注入，不要提交到仓库。完整的公开匹配功能至少需要：

- `SITE_URL`
- `DEEPSEEK_API_KEY`
- 需要 OCR 时再配置 `ZHIPU_API_KEY`

当前管理后台使用 Sites 提供的身份请求头。请用英文逗号分隔小写邮箱，写入 `ADMIN_EMAILS` 白名单。如果部署到其他平台，需要替换这一身份验证适配层，并提供等价数据库绑定。

## 4. 可选数据分析

前端事件需要 `NEXT_PUBLIC_GA_MEASUREMENT_ID`。在 `/admin` 中读取 GA4 报表还需要：

- `GA4_PROPERTY_ID`
- `GA4_SERVICE_ACCOUNT_EMAIL`
- `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`

服务账号只应获得目标 GA4 Property 所需的权限。详见 [GA4 后台配置](ga4-admin-setup.zh-CN.md)。

## 5. 发布前验收

```bash
npm run doctor
npm run lint
npm run build
```

然后分别验证：内置示例、文字型 PDF、已开启 OCR 时的扫描图片、一次真实 AI 分析、导出、隐私页面和管理员访问。

## 安全边界

不要提交 `.env.local`、`.openai/hosting.json`、服务账号 JSON、真实简历或生产日志。每个部署者需要自行负责用户授权、数据保留、模型服务条款和当地隐私要求。
