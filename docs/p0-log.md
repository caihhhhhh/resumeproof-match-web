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

## 下一步

1. 选定简历 → 对短名单前 3 条跑 `/api/match/analyze`（或本地等价流程），记录耗时与 token。
2. 选 1 条做定向版 + `fact-audit`，导出 PDF。
3. 生成投递包（简历 + 求职信 + 邮件草稿），人工确认后走跳转或邮件。
4. 把耗时/失败点回填本文件，作为 P1 排期依据。
