'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const kpis = [
  { label: '今日分析', value: '284', delta: '+18.2%', tone: 'blue' },
  { label: '完整报告率', value: '96.8%', delta: '+2.4%', tone: 'green' },
  { label: 'P50 响应', value: '5.6s', delta: '-0.8s', tone: 'violet' },
  { label: '异常请求', value: '7', delta: '需查看', tone: 'orange' },
] as const;

const requests = [
  { time: '10:42:18', type: 'JD 匹配', model: 'DeepSeek Flash', duration: '5.2s', status: '完成' },
  { time: '10:40:53', type: '扫描件 OCR', model: 'GLM-4.6V Flash', duration: '8.9s', status: '完成' },
  { time: '10:38:11', type: 'JD 匹配', model: 'DeepSeek Flash', duration: '—', status: '已降级' },
  { time: '10:35:46', type: '文件解析', model: 'Local parser', duration: '1.1s', status: '完成' },
  { time: '10:31:09', type: 'JD 匹配', model: 'DeepSeek Flash', duration: '6.4s', status: '完成' },
] as const;

const incidents = [
  { time: '10:38', title: 'AI 返回结构不完整', copy: '系统已自动转为可读对比，并保留证据与修改建议。', state: '已处理' },
  { time: '09:54', title: 'OCR 响应时间升高', copy: 'P95 达到 12.4 秒，尚未影响成功率。', state: '观察中' },
  { time: '昨天', title: '连续无效文件上传', copy: '同一来源触发 5 次格式校验，已进入限流。', state: '已拦截' },
] as const;

const feedback = [
  { score: '4.7', label: '建议有帮助', value: 87 },
  { score: '4.4', label: '原因解释清楚', value: 81 },
  { score: '4.1', label: '愿意再次使用', value: 76 },
] as const;

type AdminDashboardProps = {
  adminName: string;
  adminEmail: string;
  signOutPath: string;
};

export default function AdminDashboard({ adminName, adminEmail, signOutPath }: AdminDashboardProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<'今日' | '7 天' | '30 天'>('今日');
  const [search, setSearch] = useState('');
  const [safeMode, setSafeMode] = useState(true);
  const [editingProvider, setEditingProvider] = useState<'deepseek' | 'zhipu' | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [credentialNotice, setCredentialNotice] = useState('');
  const [gaMeasurementId, setGaMeasurementId] = useState(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '');
  const [gaNotice, setGaNotice] = useState('');

  useGSAP(() => {
    gsap.from('.admin-kpi-card', {
      y: 28,
      opacity: 0,
      duration: 0.75,
      stagger: 0.08,
      ease: 'power3.out',
    });

    gsap.fromTo('.admin-progress-fill',
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.admin-feedback-panel',
          start: 'top 82%',
          end: 'top 52%',
          scrub: 0.6,
        },
      },
    );

    gsap.from('.admin-incident', {
      y: 36,
      opacity: 0,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.admin-incident-stack',
        start: 'top 84%',
        end: 'top 58%',
        scrub: 0.5,
      },
    });

    gsap.fromTo('.admin-credential-card', {
      opacity: 0.32,
      scale: 0.985,
    }, {
      opacity: 1,
      scale: 1,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.admin-credential-grid',
        start: 'top 88%',
        end: 'top 60%',
        scrub: 0.5,
      },
    });
  }, { scope: shellRef });

  const visibleRequests = requests.filter((item) =>
    `${item.type} ${item.model} ${item.status}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="admin-shell" ref={shellRef}>
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand" aria-label="返回 ResumeProof Match 首页">
          <span className="admin-brand-mark">RP</span>
          <span>ResumeProof</span>
        </Link>

        <nav className="admin-nav" aria-label="后台导航">
          <a className="is-active" href="#overview"><span>总览</span></a>
          <a href="#requests"><span>请求记录</span></a>
          <a href="#quality"><span>模型质量</span></a>
          <a href="#feedback"><span>用户反馈</span></a>
          <a href="#credentials"><span>API 密钥</span></a>
          <a href="#settings"><span>系统设置</span></a>
        </nav>

        <div className="admin-sidebar-foot">
          <span className="admin-online-dot" />
          <div><b>系统运行正常</b><span>示例数据模式</span></div>
        </div>
        <a className="admin-signout" href={signOutPath}>退出管理员</a>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-overline">OPERATIONS CONSOLE</span>
            <h1>看清系统，再做决定。</h1>
          </div>
          <div className="admin-top-actions">
            <div className="admin-range" aria-label="数据时间范围">
              {(['今日', '7 天', '30 天'] as const).map((item) => (
                <button key={item} className={range === item ? 'is-active' : ''} onClick={() => setRange(item)}>{item}</button>
              ))}
            </div>
            <div className="admin-account" title={adminEmail}>
              <span><b>{adminName}</b><small>管理员</small></span>
              <button className="admin-avatar" aria-label={`管理员账户：${adminName}`}>{adminName.slice(0, 1).toUpperCase()}</button>
            </div>
          </div>
        </header>

        <section id="overview" className="admin-section admin-overview">
          <div className="admin-section-heading">
            <div><h2>运行概览</h2><p>{range} · 所有数字均为界面原型示例</p></div>
            <span className="admin-live"><i /> LIVE PREVIEW</span>
          </div>

          <div className="admin-kpi-grid">
            {kpis.map((item) => (
              <article className={`admin-kpi-card tone-${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.delta}</small>
                <div className="admin-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-grid-row" id="quality">
          <article className="admin-panel admin-quality-panel">
            <div className="admin-panel-head"><div><h2>模型与流程质量</h2><p>定位问题发生在哪一步，而不是只看最终失败率。</p></div><button>查看详情</button></div>
            <div className="admin-pipeline">
              <div><span>文件解析</span><strong>99.2%</strong><i style={{ '--fill': '99.2%' } as React.CSSProperties} /></div>
              <div><span>内容识别</span><strong>97.6%</strong><i style={{ '--fill': '97.6%' } as React.CSSProperties} /></div>
              <div><span>AI 分析</span><strong>96.8%</strong><i style={{ '--fill': '96.8%' } as React.CSSProperties} /></div>
              <div><span>审核稿生成</span><strong>98.4%</strong><i style={{ '--fill': '98.4%' } as React.CSSProperties} /></div>
            </div>
            <div className="admin-quality-summary">
              <div><span>主要损耗点</span><b>扫描件识别</b></div>
              <div><span>自动降级覆盖</span><b>100%</b></div>
              <div><span>需人工处理</span><b>3 次</b></div>
            </div>
          </article>

          <article className="admin-panel admin-incident-panel">
            <div className="admin-panel-head"><div><h2>需要关注</h2><p>按影响而非时间排序。</p></div><span className="admin-count">3</span></div>
            <div className="admin-incident-stack">
              {incidents.map((item) => (
                <div className="admin-incident" key={item.title}>
                  <time>{item.time}</time>
                  <div><b>{item.title}</b><p>{item.copy}</p></div>
                  <span>{item.state}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section id="requests" className="admin-panel admin-requests-panel">
          <div className="admin-panel-head admin-request-head">
            <div><h2>最近请求</h2><p>只显示运行元数据，不保存简历或 JD 原文。</p></div>
            <label className="admin-search"><span>搜索</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="类型、模型或状态" /></label>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>时间</th><th>请求类型</th><th>处理方式</th><th>耗时</th><th>状态</th></tr></thead>
              <tbody>
                {visibleRequests.map((item) => (
                  <tr key={`${item.time}-${item.type}`}>
                    <td>{item.time}</td><td>{item.type}</td><td>{item.model}</td><td>{item.duration}</td>
                    <td><span className={item.status === '已降级' ? 'status-warn' : 'status-ok'}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-grid-row admin-bottom-row" id="feedback">
          <article className="admin-panel admin-feedback-panel">
            <div className="admin-panel-head"><div><h2>用户感受到什么</h2><p>结果可信度比表面活跃更重要。</p></div><strong>4.5 / 5</strong></div>
            <div className="admin-feedback-list">
              {feedback.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span><div><i className="admin-progress-fill" style={{ width: `${item.value}%` }} /></div><b>{item.score}</b>
                </div>
              ))}
            </div>
            <blockquote>“终于不是只告诉我缺关键词，而是能说明哪段经历已经对应，以及应该怎么改。”</blockquote>
          </article>

          <article className="admin-panel admin-settings-panel" id="settings">
            <div className="admin-panel-head"><div><h2>隐私与保护</h2><p>默认少留数据，必要时再扩展。</p></div></div>
            <button className="admin-setting-row" onClick={() => setSafeMode((current) => !current)} aria-pressed={safeMode}>
              <span><b>不保存材料原文</b><small>仅保留匿名运行指标</small></span>
              <i className={safeMode ? 'is-on' : ''}><em /></i>
            </button>
            <div className="admin-setting-row is-static"><span><b>API 限流</b><small>异常请求自动降速</small></span><strong>已开启</strong></div>
            <div className="admin-setting-row is-static"><span><b>管理权限</b><small>正式接入时启用管理员认证</small></span><strong>待接入</strong></div>
          </article>
        </section>

        <section className="admin-credentials" id="credentials">
          <div className="admin-section-heading">
            <div><h2>API 密钥</h2><p>浏览器永远看不到当前密钥；只有输入新密钥时才会提交替换。</p></div>
            <span className="admin-credential-mode">界面原型 · 暂不写入</span>
          </div>

          <div className="admin-credential-grid">
            <article className="admin-credential-card">
              <div className="admin-provider-head"><span className="admin-provider-mark">DS</span><div><b>DeepSeek</b><small>匹配分析与优化建议</small></div><i>已配置</i></div>
              <dl><div><dt>模型</dt><dd>DeepSeek Flash</dd></div><div><dt>密钥状态</dt><dd>服务端 Secret</dd></div><div><dt>最近验证</dt><dd>今日 04:15</dd></div></dl>
              <button className="admin-replace-button" onClick={() => { setEditingProvider('deepseek'); setDraftKey(''); setShowKey(false); setCredentialNotice(''); }}>更换密钥</button>
            </article>

            <article className="admin-credential-card">
              <div className="admin-provider-head"><span className="admin-provider-mark is-zhipu">GLM</span><div><b>智谱 GLM</b><small>扫描件与图片 OCR</small></div><i>已配置</i></div>
              <dl><div><dt>模型</dt><dd>GLM-4.6V-Flash</dd></div><div><dt>密钥状态</dt><dd>服务端 Secret</dd></div><div><dt>最近验证</dt><dd>今日 04:15</dd></div></dl>
              <button className="admin-replace-button" onClick={() => { setEditingProvider('zhipu'); setDraftKey(''); setShowKey(false); setCredentialNotice(''); }}>更换密钥</button>
            </article>
          </div>

          <article className="admin-ga-card">
            <div className="admin-ga-copy">
              <span className="admin-provider-mark is-ga">GA4</span>
              <div><b>Google Analytics 4</b><small>只记录匿名页面与产品漏斗事件，不发送简历、JD 或文件名。</small></div>
            </div>
            <div className="admin-ga-form">
              <label htmlFor="ga-measurement-id">Measurement ID</label>
              <div>
                <input id="ga-measurement-id" value={gaMeasurementId} onChange={(event) => { setGaMeasurementId(event.target.value.toUpperCase().trim()); setGaNotice(''); }} placeholder="G-XXXXXXXXXX" />
                <button
                  disabled={!/^G-[A-Z0-9]+$/.test(gaMeasurementId)}
                  onClick={() => setGaNotice('格式检查通过。正式接入管理员认证后才会保存并启用追踪。')}
                >验证并保存</button>
              </div>
              <small>{gaMeasurementId ? '已输入 Measurement ID' : '当前未配置，Google 脚本不会加载。'}</small>
              {gaNotice && <p>{gaNotice}</p>}
            </div>
          </article>

          {editingProvider && (
            <div className="admin-key-drawer" role="region" aria-live="polite">
              <div className="admin-key-drawer-copy">
                <span>正在更换</span>
                <h3>{editingProvider === 'deepseek' ? 'DeepSeek API Key' : '智谱 GLM API Key'}</h3>
                <p>保存后应先完成连接测试，再替换当前服务端密钥。系统不会显示或下载旧密钥。</p>
              </div>
              <div className="admin-key-form">
                <label htmlFor="replacement-key">新密钥</label>
                <div className="admin-key-input-wrap">
                  <input
                    id="replacement-key"
                    type={showKey ? 'text' : 'password'}
                    value={draftKey}
                    onChange={(event) => { setDraftKey(event.target.value); setCredentialNotice(''); }}
                    placeholder={editingProvider === 'deepseek' ? 'sk-••••••••••••••••' : '输入新的 GLM API Key'}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowKey((current) => !current)}>{showKey ? '隐藏' : '显示'}</button>
                </div>
                <small>密钥只应发送到受管理员认证保护的服务端接口。</small>
                {credentialNotice && <p className="admin-key-notice">{credentialNotice}</p>}
                <div className="admin-key-actions">
                  <button className="admin-key-cancel" onClick={() => { setEditingProvider(null); setDraftKey(''); setCredentialNotice(''); }}>取消</button>
                  <button
                    className="admin-key-save"
                    disabled={draftKey.trim().length < 12}
                    onClick={() => setCredentialNotice('格式检查通过。接入管理员认证后才会执行真实连接测试与保存。')}
                  >验证并保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="admin-key-security-note">
            <b>安全边界</b>
            <p>不显示旧密钥、不写入浏览器存储、不把密钥放进前端代码。正式版本还会记录更换时间和操作账户，但不会记录密钥正文。</p>
          </div>
        </section>

        <footer className="admin-footer">
          <span>ResumeProof Match Admin · Prototype</span>
          <Link href="/">返回用户端</Link>
        </footer>
      </main>
    </div>
  );
}
