# ResumeProof 岗位捕获插件

BOSS直聘 / 猎聘 / 智联招聘 没有公开岗位 API，服务端抓取又违反平台协议。这个插件走「用户自己的浏览器」：打开岗位详情页，点一下按钮，把**当前这一条**岗位发到本机运行的捕获桥。

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

## 边界（有意为之）

- 只在**你点击**时读取当前页，不后台翻页、不批量抓取、不模拟点击、不自动投递。
- 不读取登录态、Cookie、聊天记录；只取标题/公司/地点/薪资/JD 文本。
- 发送目标是 `127.0.0.1`，不经过公网。

## 选择器维护

三家站点改版会让选择器失效。`content.js` 里每个字段都有多层选择器 + 兜底（`main` 文本），失效时通常还能抓到 JD，只是标题/公司可能不准。改版后按实际 DOM 调整 `extractTitle` / `extractCompany` / `extractJd` 即可。
