# P0 执行日志

日期：2026-11-03 / 2026-11-04（Asia/Shanghai）
范围：只验证闭环，不写产品功能代码。

## 已完成

### 1. 线上代码收口
- 仓库：`https://github.com/caihhhhhh/resumeproof-match-web`
- 提交：`9ea6796 Ship editorial redesign with bundled Noto Sans SC`、`6899342 Record design review snapshots from September to October`
- 内容：12 个已部署改动 + 新增 5 个组件/lib 文件 + `public/fonts/`（16.1 MB，Noto Sans SC）+ 4 组评审快照（55 文件）。
- 推送结果：`d6424fe..6899342 main -> main`，工作区干净。线上代码首次进入 git 历史。
- 备注：`.impeccable/`（本地评审缓存）已加入 `.gitignore`。

### 2. 数据契约
- `docs/schemas/profile.schema.json`：画像 + 事实台账（facts 必须 `confirmed` 才能被改写引用）。
- `docs/schemas/job.schema.json`：归一化岗位，`rawSource` 保留原始 payload。
- `docs/schemas/application.schema.json`：投递记录，含同意字段与状态机。
- `docs/schemas/README.md`：不变量（事实先行、幂等、状态机、同意先于外发、90 天留存）。

### 3. 公开岗位源验证（`scripts/p0/discover.mjs`）
- 来源：腾讯招聘公开接口（`careers.tencent.com/tencentcareer/api/post/Query`），8 个关键词 × 50 条。
- 结果：抓取 240 → 去重 192 → 硬筛通过 128 → 短名单 20。
- 硬筛规则：城市（上海/深圳/广州）、排除实习、经验 >3 年剔除、排除词。
- 产出：`tmp/p0/jobs.raw.json`、`shortlist.json`、`shortlist.md`、`run.json`。
- 短名单特征：以腾讯 IEG/CSIG/微信的海外发行、市场营销、广告投放岗为主，地点集中在深圳，少量上海/广州。

### 4. 供应链事实核查（推翻了 v1.2 的一个关键假设）
- `liepin-cli` 是**猎聘招聘者端**（lpt.liepin.com）工具：搜候选人、看投递、打招呼；**不是求职者投递工具**。skill 里的 `job apply` 指的是招聘方操作。
- 结论：猎聘不作为公开版投递通道；方案 v2.0 已删除。
- 其他实测：Binance 的 Ashby board 返回空数组；字节招聘接口返回 HTML（需签名头）；Coinbase 261 条岗位以美国 remote 为主，APAC 增长岗少。

## 未完成（需要输入）

- 真实简历端到端：简历三选一（`RENZO_Resume_Channel_Growth_CN_Formal.pdf` / `Will_Resume_Kraken_Performance_Marketing_EN.pdf` / 最新 `Will_Resume_BPN_Payment_Operations_EN.md`），确认后才能跑深度匹配与定向改写。
- 邮件投递一步需要用户确认收件人（JD 明示邮箱）与发件账号。
- LLM 成本尚未产生（本轮只做规则筛）。

## P0.2 多源引擎与平台捕获桥（2026-11-04）

### 多源发现引擎
- `scripts/jobs/{lib,sources,discover}.mjs` + `catalog.json`，7 个适配器覆盖 43 个源：
  - 中国公司接口：腾讯、网易、美团（各按关键词抓取）。
  - 海外 ATS：Greenhouse（Stripe/Airbnb/Figma/Databricks/Discord/Coinbase/Gemini/Reddit/Robinhood/Dropbox/Instacart/Pinterest/Duolingo、Anthropic、Vercel、Brex、Scale AI、GitLab、Twilio、Okta、MongoDB、Elastic、Cloudflare、Datadog、Lyft、Asana、Mixpanel、Braze、Klaviyo、Intercom）、Lever（Spotify/Outreach）、Ashby（Ramp/Linear/Cursor）、Workday（NVIDIA/Salesforce/Adobe/Cisco/Intel）。
- 实测：43 源 → 7851 条 → 去重 7506 → 硬筛 221 → 短名单 40（每家公司最多 6 条）。
- 失败隔离：单源异常只记 `perSource[id].error`，不影响其他源；OpenAI Ashby 因单次 payload 13MB 暂关。
- 修正：`2025年毕业` 曾被当成「2025 年经验」；`3-5年` 取区间下限；总监/VP 标题降 6 分；仅美国 remote 的岗位按 UTC+7 时区拒掉（`US, Remote` 曾被漏判，现按 city 精确匹配）。

### 平台捕获桥（BOSS/猎聘/智联）
- `scripts/jobs/bridge.mjs`：仅绑定 127.0.0.1:7717，`POST /capture` 校验 site/url/JD 长度，写 `tmp/jobs/inbox/`。
- `tools/capture-extension/`：MV3 content script，仅在三家岗位详情页出现按钮；点击才读取当前页；多层选择器 + `main` 兜底。
- 验证：起桥 → POST 一条样例 → 生成 inbox JSON → `discover.mjs` 合并进短名单（见 run.json 的 `captures` 计数）。
- 边界：不后台翻页、不模拟点击、不自动投递、不读 Cookie。

## P0.3 国内 50 家接入（2026-11-04）

### 选型
- 对比了自写适配器、`boss-zhipin-scraper`、`liepin-cli`、`HA7CH/job-pro` 四条路。结论：国内招聘官网以 Moka、飞书招聘、北森为主，逐个公司写不现实；`@ha7ch/job-pro`（MIT，25★，v1.2.1）已覆盖 50 家、23 个自建 API + 3 家 ATS 家族。
- 只调用只读命令：`list`、`find`、`detail`。不调用 `apply`，不碰登录态，不做自动投递。

### 实现
- `scripts/jobs/jobpro.mjs`：8 个关键词（增长/营销/市场/投放/品牌/运营/商务拓展/海外）× 每关键词每公司 8 条 → 归一化 → 按标题相关度 × 城市排序 → 并发 4 拉取 top 40 的完整 JD（`detail`）→ 写 `tmp/jobs/cn.json`。
- Windows 下 `npx.cmd` 不能直接 `execFile`（EINVAL），改为 shell 执行并对参数加引号。
- `discover.mjs` 新增 `--no-cn` 与 `cn.json` 合并：来源名 `jobpro`，`_scope='cn'`，参与同一套去重/硬筛/打分。
- 硬筛补中文标题闸门：产品经理/产品专家/设计师/工程师/开发/算法/数据分析/分析师/架构师/销售 一律剔除；`employment_type` 含实习/校招/应届/培训生剔除。

### 实测
- 国内扫描：8 个关键词 → 1,194 条唯一岗位 / 37 家公司，补全 37 份 JD，0 失败。
- 合并后全量：44 个源 → 9,070 条 → 去重 8,650 → 硬筛 493 → 短名单 40（25 条来自国内源）。
- 短名单头部：网易「海外广告投放」19 分、网易「海外市场营销（UA策略）18、MiniMax「市场营销经理-海外方向」16、MiniMax「海外广告投放」16、小红书「品牌与种草广告」16、腾讯「SLG-海外游戏投放经理」15。
- 观察：飞书招聘系（MiniMax/小鹏/蔚来/智元）岗位新、JD 完整；Moka 系（MiniMax/小红书/米哈游/DeepSeek）质量高但部分岗位无 JD；猎聘聚合源（菜鸟）只有跳转链接。

## P0.4 站内岗位库 + 插件批量采集（2026-11-04）

### 实现
- **D1**：`db/schema.ts` 加 `saved_jobs`（`UNIQUE(user_id, dedupe_hash)`，字段 title/company/salary/location/url/jd/site/captured_at_ms）与 `sync_tokens`（只存 token 的 sha256）。
- **API**：`GET /api/jobs`（登录，搜索 + 分页）、`POST /api/jobs`（`Bearer` 同步令牌，`{site,jobs[]}`，1..30 条，限 60 次/分、2MB）、`DELETE /api/jobs/[id]`、`POST /api/jobs/sync-token`（登录签发 64 位 hex）。
- **页面**：`/jobs`，登录后可见；搜索框、站点 badge、JD 220 字摘要、「打开原岗位 / 用这份 JD 匹配」、分页、空状态、令牌卡片（三步接入说明）。
- **插件**：`tools/capture-extension/content.js` 列表页注入「采集本页 (N)」，抓当前已渲染的 ≤30 张卡片（多层选择器兜底、URL 去重、不自动翻页）；详情页单条采集保留。
- **桥**：`POST /capture/batch`（全量校验、索引化错误、启动时扫 inbox 去重）；`sync --token <token> --site <baseUrl>`（按站点分组、30 条/请求、2xx 后移入 `tmp/jobs/synced`、失败保留文件并退出码 1）。

### 实测
- 本地 dev（Cloudflare/workerd）签发令牌 → `POST /api/jobs` 2 条 → `GET` total=2 → 重复同步 total 仍 2（幂等）→ `/jobs` HTML 含标题 → 删除 1 条 → 剩 1 条 → 无令牌 POST 401。
- 桥 `sync`：2 个文件 → 2 个请求 → 文件移入 `tmp/jobs/synced`；mock 400 时退出码 1 且保留文件。
- 校验：`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过。
- 环境坑：`vinext start` 不支持 `cloudflare:workers`（`ERR_UNSUPPORTED_ESM_URL_SCHEME`），必须 `npm run dev`；dev 下要带 `Cookie: __sites_local_auth=1` 才会注入本地用户头（插件会剥掉伪造的 `oai-*` 头）；dev 只监听 `::1`，用 `http://localhost:3001`。

### 未做
- 引擎结果（`tmp/jobs/jobs.json`）尚未写 D1 `jobs` 表；`/jobs` 目前只显示插件同步的岗位。
- 尚未部署到线上 Sites（本地验证通过，发布动作待定）。
- 插件选择器未在真实 BOSS/智联/猎聘 页面回归。

## 下一步

1. 引擎产物落 D1（`jobs` 表）+ 定时抓取 + 站内「上传后匹配」读取，否则用户在网站上还看不到这批岗位。
2. 选定简历 → 深度匹配 3 条 → 定向版 1 → 投递包 1。
3. 捕获桥的站点选择器在三家真实页面各回归一次。
4. 国内缺口：大疆/SHEIN/联想/中兴/得物/完美世界/鹰角/同程旅行 自建接口未覆盖，逐个验证后加 catalog。



## P0.5 站内扩展下载 + 首轮试跑（2026-11-04）

### 实现
- `app/extension/page.tsx` + `app/extension/extension.css`：公开安装页（四步、边界、FAQ、下载），导航 + 页尾 + 首页结尾各加入口。
- `public/downloads/resumeproof-capture.zip`（7,091 字节，manifest 在根目录）；`npm run ext:zip` 用 Compress-Archive 重新打包，`tools/capture-extension/README.md` 记录流程。
- `/jobs`：来源筛选（站点 chip + 每站计数）、`countSavedJobsBySite`、`site` 查询参数、顶部「下载采集扩展 / 直接匹配现有 JD」两个 CTA、令牌卡片步骤改为链接到安装页与 zip。

### 试跑
- 桥 `POST /capture/batch` 收到 30 条 BOSS 岗位（米哈游/小红书/网易等）→ `202 accepted 30`；`bridge sync` 1 个请求推送 30 条，文件移入 `tmp/jobs/synced`；`/jobs` 渲染 30 张卡片，搜索「米哈游」3 条，`GET /api/jobs` total=30。
- 真实匹配：`RENZO_Resume_Channel_Growth_CN_Formal.pdf` 抽正文 + Stripe Growth Marketing Manager (Greater China) JD → `POST /api/match/analyze` 200，14.1s，16 evidence / 4 hardRequirements。
- 校验：`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过；扩展页与 zip 均 200。
- 环境：dev 仍在 3001（旧进程复用），桥在 7717。

### 未做
- 线上未发布：DSH 环境没有 Sites 发布通道，需要回到 ChatGPT/Codex 的 Sites 动作重新部署。
- 扩展选择器未在真实 BOSS/智联/猎聘 页面回归；30 条试跑数据是构造的。

## P0.6 真实页面回归：猎聘 30 条打通，BOSS 被 IP 风控（2026-11-04）

### 结果
- **猎聘真实回归通过**：`https://www.liepin.com/zhaopin/?key=增长` 未登录仍渲染 30 张卡；点「采集本页 (30)」→ 桥 inbox 30 个文件 → `bridge sync` 一次请求 → `/jobs` 显示 30 条 / 1 个来源，卡片含标题、公司、薪资、地点（如「电商商品运营经理…｜喵铮铮｜20-40k｜上海-闵行区」「蚂蚁财富海外-用户增长…｜蚂蚁集团｜30-60k·15薪｜深圳-南山区」）。构造数据已全部清掉，库里只剩这次真实采集。
- **BOSS 无法回归**：匿名和新开的干净 Chrome 窗口都 302 到 `https://www.zhipin.com/web/passport/zp/verify.html?...&code=35`，文案「当前 IP 地址可能存在异常访问行为」——本机出口 IP 已被 BOSS 风控标记（大概率是之前服务端探测触发）。这不是选择器问题；换网络或等风控解除后才能验证。
- **智联站点结构已换代**：`sou.zhaopin.com` 会跳 `www.zhaopin.com/jobs/?kw=…`，卡片是 `.job-card`（`__title-main`/`__salary`/`__skill-tag`），且卡片内只有公司详情链接、没有岗位 URL（点击在 SPA 内开详情）。现有选择器与「必须有岗位 URL」的约束都不匹配，需要单独一版适配。
- 猎聘真实 DOM 也已改成 CSS Modules（`_40108OjE3M jobCardPcContainer`、`jobTitleBox`、`jobCompanyInfoBox`），旧 `.job-list-item` 完全失效；已补 `[class*="jobCardPcContainer"]`、`[class*="jobTitleBox"]`、`.jobCompanyInfoBox .companyName`、`【…】` 地点解析。

### 修复
- **Chrome 138+ Local Network Access**：HTTPS 页面里的 content script 直接 `fetch('http://127.0.0.1:7717')` 会被 LNA 拦住（请求挂起，不报错）。改为 content script → `background.js` service worker → 桥；manifest 升 0.2.0，`host_permissions` 保留 `http://127.0.0.1:7717/*`，重新打包 zip。
- 桥加 `access-control-allow-private-network: true`，配合 service worker 的预检。
- 采集按钮卡在「发送中…」的问题随 service worker 改造一起消失。

### 仍需
- 智联适配（新 DOM + SPA 详情 URL）；BOSS 等 IP 解封后回归；线上发布。
