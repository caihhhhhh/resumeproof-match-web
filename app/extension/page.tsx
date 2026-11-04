import type { Metadata } from 'next';
import Link from 'next/link';
import { chatGPTSignInPath } from '../chatgpt-auth';
import './extension.css';

export const metadata: Metadata = {
  title: '采集扩展 | ResumeProof Match',
  description: '在 BOSS、智联、猎聘 的搜索页一键采集岗位，登录态不离开你的浏览器，同步进 ResumeProof 岗位库。',
  alternates: { canonical: '/extension' },
  openGraph: {
    type: 'website',
    url: '/extension',
    title: '采集扩展 | ResumeProof Match',
    description: '把 BOSS、智联、猎聘 上看到的岗位，一键收进 ResumeProof 岗位库。',
  },
};

const steps = [
  {
    title: '下载并解压',
    body: '下载 zip 后解压到一个固定目录，例如 D:\\ResumeProof\\capture-extension。不要删掉这个目录，浏览器会直接读它。',
  },
  {
    title: '加载到 Chrome',
    body: '打开 chrome://extensions，右上角开启「开发者模式」，点「加载已解压的扩展程序」，选择刚才解压的目录。',
  },
  {
    title: '启动本机桥',
    body: '在项目目录运行 node scripts/jobs/bridge.mjs。它只监听 127.0.0.1:7717，不对外网开放。',
  },
  {
    title: '在平台搜索页采集',
    body: '打开 BOSS、智联或猎聘的搜索结果页，点右下角「采集本页 (N)」。采集到的岗位先落到本机，再用 /jobs 页面生成的同步令牌推送进账号。',
  },
];

const boundaries = [
  '只在你点击按钮时读取当前页面已经渲染的岗位卡片，不做后台抓取。',
  '不读取、不上传 Cookie 或登录凭证；登录态始终留在你的浏览器里。',
  '不自动翻页、不自动打招呼、不自动投递，也不修改平台页面上的任何数据。',
  '采集结果先写入本机 tmp/jobs/inbox，只有你执行 sync 时才会发到你自己的账号。',
];

export default function ExtensionPage() {
  return (
    <div className="ext-shell">
      <nav className="ext-nav">
        <Link className="ext-brand" href="/">ResumeProof<span> Match</span></Link>
        <div className="ext-nav-links">
          <Link href="/jobs">岗位库</Link>
          <Link href="/guide">匹配方法</Link>
          <Link href="/match/new">开始匹配</Link>
          <a href={chatGPTSignInPath('/jobs')}>登录</a>
        </div>
      </nav>

      <main className="ext-main">
        <header className="ext-hero">
          <span className="ext-eyebrow">BROWSER EXTENSION / 采集扩展</span>
          <h1>把你在平台上看到的岗位，一键收进 ResumeProof。</h1>
          <p>
            BOSS、智联、猎聘 没有公开岗位接口，服务端代查会触发风控。这个扩展换一种做法：
            用你自己的浏览器、你自己的登录态，只采集你正在看的那一页岗位，再同步到你的岗位库。
          </p>
          <div className="ext-actions">
            <a className="ext-primary" href="/downloads/resumeproof-capture.zip" download>
              下载扩展（zip）
            </a>
            <Link className="ext-secondary" href="/jobs">去岗位库生成令牌</Link>
          </div>
          <small className="ext-note">Chrome / Edge 110+ · 约 7 KB · 开源代码在仓库 tools/capture-extension/</small>
        </header>

        <section className="ext-section" aria-labelledby="install">
          <h2 id="install">四步装好</h2>
          <ol className="ext-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <b>{step.title}</b>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ext-section" aria-labelledby="boundary">
          <h2 id="boundary">它做什么，不做什么</h2>
          <ul className="ext-list">
            {boundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="ext-section" aria-labelledby="faq">
          <h2 id="faq">常见问题</h2>
          <dl className="ext-faq">
            <div>
              <dt>按钮没有出现？</dt>
              <dd>确认当前是搜索结果列表页或岗位详情页，然后刷新一次；单页应用切换路由后需要刷新才会注入脚本。</dd>
            </div>
            <div>
              <dt>一页能采多少条？</dt>
              <dd>只采集当前已经渲染出来的卡片，最多 30 条。想采更多就往下滚一点、再点一次，扩展不会替你翻页。</dd>
            </div>
            <div>
              <dt>采集后岗位在哪？</dt>
              <dd>先写到本机 tmp/jobs/inbox；在 /jobs 生成同步令牌后运行 bridge sync，才会进入你的账号岗位库。</dd>
            </div>
            <div>
              <dt>会不会导致账号异常？</dt>
              <dd>扩展只读页面、不调平台接口，频率由你手点决定。仍建议放慢节奏、不要连续快速采集几十页。</dd>
            </div>
          </dl>
        </section>

        <section className="ext-cta">
          <h2>岗位收进来之后</h2>
          <p>用同一份简历逐条匹配，先判断差距，再决定改哪一版。需要时再回到平台投递，我们不代投。</p>
          <Link className="ext-primary" href="/jobs">打开岗位库</Link>
        </section>
      </main>
    </div>
  );
}
