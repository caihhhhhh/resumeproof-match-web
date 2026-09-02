# ResumeProof UTM 渠道管理手册

更新日期：2026-09-02
网站主页：<https://resumeproof.szw19990924.chatgpt.site/>

## 1. 使用原则

ResumeProof 当前记录以下三个归因字段：

| 字段 | 用途 | 命名规则 | 示例 |
| --- | --- | --- | --- |
| `utm_source` | 区分具体平台 | 建议使用小写平台名，可自定义 | `reddit` |
| `utm_medium` | 区分渠道类型 | 建议使用下表中的值，可自定义 | `community` |
| `utm_campaign` | 区分推广主题或批次 | 小写英文、数字和下划线 | `launch_202608` |

统一要求：

- 三个字段都可以在后台生成器中修改；自定义时仍建议同一个平台始终使用同一个 `utm_source`，不要一会儿写 `x`、一会儿写 `twitter`。
- 同一轮推广使用相同的 `utm_campaign`，方便横向比较不同渠道。
- 不要在 UTM 中填写姓名、邮箱、账号 ID 或其他个人信息。
- 链接必须以完整的 `https://` 开头。
- 当前后台不统计 `utm_content` 和 `utm_term`，暂时不要把它们作为主要归因依据。

## 2. 固定渠道字典

下表是便于长期对比的推荐模板，不是强制限制。选择模板后，仍可继续修改 Source、Medium 和 Campaign。

| 发布渠道 | `utm_source` | `utm_medium` | 使用场景 |
| --- | --- | --- | --- |
| Reddit | `reddit` | `community` | Subreddit 帖子、评论中的产品链接 |
| X | `x` | `social` | 普通帖子、Thread、个人主页 |
| LinkedIn | `linkedin` | `social` | 动态、文章、个人主页 Featured |
| 小红书 | `xiaohongshu` | `social` | 笔记正文、评论区、个人简介 |
| V2EX | `v2ex` | `community` | 主题帖和后续更新 |
| GitHub | `github` | `referral` | README、Release、仓库 About |
| 其他社区 | `community_name` | `community` | 即刻、少数派等社区讨论 |
| 其他网站 | `site_name` | `referral` | 博客、目录站、合作伙伴网站 |
| 邮件 | `email` | `email` | Newsletter 或定向邮件 |

## 3. 可直接复制的首轮推广链接

本轮统一 Campaign：`launch_202608`

| 渠道 | 完整链接 |
| --- | --- |
| Reddit | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=reddit&utm_medium=community&utm_campaign=launch_202608> |
| X | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=x&utm_medium=social&utm_campaign=launch_202608> |
| LinkedIn | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=linkedin&utm_medium=social&utm_campaign=launch_202608> |
| 小红书 | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=xiaohongshu&utm_medium=social&utm_campaign=launch_202608> |
| V2EX | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=v2ex&utm_medium=community&utm_campaign=launch_202608> |
| GitHub | <https://resumeproof.szw19990924.chatgpt.site/?utm_source=github&utm_medium=referral&utm_campaign=launch_202608> |

GitHub 网站源码仓库中的长期入口单独使用：

<https://resumeproof.szw19990924.chatgpt.site/?utm_source=github&utm_medium=referral&utm_campaign=website_repo_202609>

这样可以把“以前发布帖子带来的流量”与“长期从源码仓库进入的流量”分开。

## 4. Campaign 命名建议

| 推广目的 | 推荐 `utm_campaign` | 说明 |
| --- | --- | --- |
| 首次公开发布 | `launch_202608` | 当前首轮推广 |
| 新版本更新 | `product_update_v16` | 版本功能发布 |
| Skill 仓库长期入口 | `skill_repo_202609` | 从 `resume-proof-match` README 和 About 进入 |
| 网站源码仓库入口 | `website_repo_202609` | 从 `resumeproof-match-web` README 和 About 进入 |
| 案例内容 | `resume_case_01` | 简历匹配案例 |
| 教程内容 | `jd_match_guide` | 使用教程或方法论 |
| 长期个人主页链接 | `evergreen_profile` | 不随单次活动变化 |
| 合作推广 | `partner_name_202608` | 将 `partner_name` 替换为合作方简称 |

## 5. 每次发布记录表

发布后复制一行继续填写。后台数据建议至少等待 24 小时后再判断，低样本量阶段不要只看转化率。

| 发布日期 | 渠道 | Campaign | 内容标题/主题 | 发布位置 | 访问旅程 | 发起分析 | 完成分析 | 完成率 | 备注 |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026-08-30 | Reddit | `launch_202608` |  |  |  |  |  |  |  |
| 2026-08-30 | X | `launch_202608` |  |  |  |  |  |  |  |
| 2026-08-30 | LinkedIn | `launch_202608` |  |  |  |  |  |  |  |
| 2026-08-30 | 小红书 | `launch_202608` |  |  |  |  |  |  |  |
| 2026-08-30 | V2EX | `launch_202608` |  |  |  |  |  |  |  |
| 2026-08-30 | GitHub | `launch_202608` |  |  |  |  |  |  |  |

## 6. 后台阅读口径

- **访问旅程**：一个浏览器标签页内的一次访问过程，不等同于真实人数。
- **发起分析**：该旅程至少点击过一次“开始 AI 分析”。
- **完成分析**：该旅程至少获得过一次完整匹配报告。
- **访问转化率**：完成分析的旅程数 ÷ 访问旅程数。
- 同一个标签页内重复点击不会重复计为多个旅程；关闭后重新打开会产生新的旅程。
- 上线 UTM 功能之前的历史访问不会被反向归因。

## 7. 判断渠道是否值得继续

每个渠道至少积累 20 个访问旅程后，再做初步比较：

1. 先看完成分析数，而不是只看访问量。
2. 完成率高但访问少：继续增加曝光。
3. 访问多但发起少：调整内容承诺或落地页入口。
4. 发起多但完成少：检查分析失败率、等待时间和材料门槛。
5. 完成多但没有审核或导出：优化结果页的建议质量与下一步引导。
