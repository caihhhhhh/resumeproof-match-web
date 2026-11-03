# 数据契约（P0）

三个 JSON Schema 定义「简历 → 岗位 → 申请」的边界字段；P1 建 D1 表时按这几个文件 1:1 落库，不再另发明字段。

| 文件 | 对应实体 | 说明 |
| --- | --- | --- |
| `profile.schema.json` | `profiles` | 候选人画像 + 事实台账（facts）。改写只能引用 `confirmed: true` 的 fact。 |
| `job.schema.json` | `jobs` | 归一化后的岗位。`rawSource` 存原始 payload，避免重复抓取。 |
| `application.schema.json` | `applications` | 一次投递动作。跳转投递也建行，否则漏斗缺口。 |

## 不变量（代码里必须守）

1. **事实先行**：`resume_versions` 的每条 bullet 必须能追溯到某个 `fact.id`；没有 fact 的数字、头衔、公司名一律拦截（`app/lib/fact-audit.ts` 已有实现）。新增事实先入台账并 `confirmed=false`，由用户确认后 `true`。
2. **幂等**：`job.id = source + ":" + source_job_id`；`dedupe_hash = sha256(lower(company) + 归一化 title + city)`。同岗位跨平台只保留一条主记录，其他平台记在 `rawSource.alsoSeenOn[]`。
3. **状态机**：
   - job：`discovered → shortlisted → (rejected | applied | expired)`
   - application：`draft → ready → sent → (replied → interview → offer) | rejected | withdrawn`
   - 只允许前进或 `withdrawn`；不允许把 `sent` 改回 `draft`。
4. **同意先于外发**：`application.consent.share_resume = true` 且有时间戳，才允许生成外发邮件或提交表单。
5. **留存**：原始简历文件默认 90 天删除，只保留 `profile`（结构化画像，不含附件）；用户删除账号时级联删除 `profiles / jobs(用户自建) / applications / resume_versions`。PIPL 第十九条。

## 版本策略

`schema_version` 从 1 开始；加字段不升版本，删改语义才升。读取端遇到未知字段直接忽略，写入端永不写未知字段。
