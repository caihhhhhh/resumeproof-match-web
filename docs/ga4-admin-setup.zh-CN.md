# ResumeProof 后台 GA4 接入

前台 Measurement ID `G-CRG0RY1N12` 只负责发送事件。后台读取报表还需要以下三项服务端配置：

1. `GA4_PROPERTY_ID`：GA4 管理页「媒体资源设置」中的纯数字 Property ID，不是 `G-` 开头的 Measurement ID。
2. `GA4_SERVICE_ACCOUNT_EMAIL`：Google Cloud 服务账号邮箱。
3. `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`：该服务账号 JSON 密钥中的 `private_key`。

## Google 侧设置

1. 在 Google Cloud 选择或创建一个项目，启用 **Google Analytics Data API**。
2. 创建一个专用于 ResumeProof 的服务账号并下载 JSON 密钥。
3. 打开 GA4「管理 → 媒体资源访问权限管理」。
4. 添加服务账号邮箱，只授予「查看者」权限。
5. 在 ResumeProof 的服务端环境中保存上述三项配置并重新部署。

私钥不得放入前端代码、GitHub、公开文档或聊天消息。接入成功后，后台会显示活跃用户、会话、浏览量、互动率，以及 Source / Medium / Campaign、页面、事件、设备和地区数据。

后台顶部的时间范围会作用于整个 GA4 模块：

- `24 小时`：GA4 按媒体资源时区显示今日数据，并与昨日对比；
- `7 天`：显示含今天在内的最近 7 个自然日，并与紧邻的前 7 日对比；
- `30 天`：显示含今天在内的最近 30 个自然日，并与紧邻的前 30 日对比。

报表在服务端缓存 5 分钟，页面显示最近一次成功更新时间。GA4 与站内匿名漏斗的统计口径不同，不应把两者的事件次数直接视为同一个用户数。
