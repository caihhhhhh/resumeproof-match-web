# ResumeProof 岗位捕获插件

BOSS直聘 / 猎聘 / 智联招聘 没有公开岗位 API，服务端抓取又违反平台协议。这个插件走「用户自己的浏览器」：打开岗位详情页，点一下按钮，把**当前这一条**岗位发到本机运行的捕获桥；在搜索结果页，再点一下「采集本页」，把**当前页已渲染的**一批岗位发过去。

## 安装

1. 启动捕获桥：
   ```
   node scripts/jobs/bridge.mjs
   ```
   默认监听 `http://127.0.0.1:7717`，只绑定本机。
2. Chrome 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选本目录。
3. 打开任意 BOSS/猎聘/智联 岗位详情页，右下角会出现「捕获到 ResumeProof」。
4. 点击后，岗位写入 `resume-proof-match-web/tmp/jobs/inbox/`。
5. 跑 `node scripts/jobs/discover.mjs`，捕获的岗位会和官网/ATS 岗位一起进短名单。

## 批量采集搜索结果页

以下页面会额外出现「采集本页 (N)」，N 是当前 DOM 中识别到的岗位卡片数（最多 30）：

| 站点 | 支持的列表页 |
| --- | --- |
| BOSS直聘 | `https://www.zhipin.com/web/geek/job`（可带查询参数） |
| 智联招聘 | `https://sou.zhaopin.com/…`、`https://www.zhaopin.com/sou…` |
| 猎聘 | `https://www.liepin.com/zhaopin…`、`https://www.liepin.com/job`（仅列表页） |

点击后从**当前已渲染的 DOM**里提取最多 30 张卡片（标题、公司、薪资、地点、绝对链接；列表页没有 JD，所以 `jd` 为空），`POST http://127.0.0.1:7717/capture/batch`。提示 `已采集 X 条（重复 Y）`；按 `site + url` 去重，之前采过的会算进「重复」。

- 不自动滚动、不自动翻页、不发起任何页面内请求。
- 采集的是点击瞬间已加载的卡片；列表懒加载时先滚动，按钮上的 N 会自动更新。
- 卡片结构对不上（选择器失效）时，按钮显示 `(0)`，点击会提示未识别到岗位。

## 同步到线上

详情页/批量采集写入 inbox 后，可以直接推送到部署好的 ResumeProof：

```
node scripts/jobs/bridge.mjs sync --token <token> --site <baseUrl> [--inbox tmp/jobs/inbox]
```

- 读取 inbox 里的每个 JSON，按站点分组、每 30 条一批，`POST <baseUrl>/api/jobs`，请求体 `{"site":"...","jobs":[...]}`，请求头 `Authorization: Bearer <token>`。
- 2xx 后把本批源文件移动到 inbox 同级的 `synced/`（默认 `tmp/jobs/synced/`）；非 2xx 打印状态码 + 响应体，退出码非 0，源文件保留。
- `sync` 模式不会启动 7717 的 HTTP 服务。
- token 在 ResumeProof 应用中生成；`--site` 是部署地址（如 `https://your-domain`），不是站点名。

## 边界（有意为之）

- 只在**你点击**时读取当前页，不后台翻页、不自动批量抓取、不模拟点击、不自动投递。
- 不读取登录态、Cookie、聊天记录；详情页只取标题/公司/地点/薪资/JD，列表页只取卡片文本和链接。
- 发送目标是 `127.0.0.1`，不经过公网。
- 列表页是单页应用：如果在站内用前端路由从别的页面跳到列表页，本文脚本不会重新注入，刷新一次即可。

## 选择器维护

三家站点改版会让选择器失效。

- 详情页：`content.js` 里每个字段都有多层选择器 + 兜底（`main` 文本），失效时通常还能抓到 JD，只是标题/公司可能不准。改版后按实际 DOM 调整 `extractTitle` / `extractCompany` / `extractJd`。
- 列表页：卡片容器在 `CARD_SELECTORS`，字段在 `FIELD_SELECTORS`（`title` / `company` / `salary` / `location` / `link` 均为选择器数组，按顺序兜底）。字段缺失时标题会退回链接文本，薪资/地点会退回卡片文本正则；没有标题或链接的卡片会被跳过。
