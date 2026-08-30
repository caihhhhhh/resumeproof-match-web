'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type { AdminRangeKey, AdminRuntimeData } from '../lib/admin-runtime';

gsap.registerPlugin(ScrollTrigger, useGSAP);

type AdminDashboardProps = {
  adminName: string;
  adminEmail: string;
  signOutPath: string;
  siteOrigin: string;
  runtimeData: AdminRuntimeData;
};

const rangeOptions: Array<{ key: AdminRangeKey; label: string }> = [
  { key: '24h', label: '24 小时' },
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
];

const utmChannels = [
  { label: 'Reddit', source: 'reddit', medium: 'community' },
  { label: 'X', source: 'x', medium: 'social' },
  { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { label: '小红书', source: 'xiaohongshu', medium: 'social' },
  { label: 'V2EX', source: 'v2ex', medium: 'community' },
  { label: 'GitHub', source: 'github', medium: 'referral' },
  { label: '邮件', source: 'email', medium: 'email' },
] as const;

function safeCampaign(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._+-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'campaign';
}

function formatEventTime(value: number | null, includeDate = false) {
  if (!value) return '尚无成功记录';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Bangkok',
    month: includeDate ? '2-digit' : undefined,
    day: includeDate ? '2-digit' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    second: includeDate ? '2-digit' : undefined,
    hour12: false,
  }).format(value);
}

export default function AdminDashboard({ adminName, adminEmail, signOutPath, siteOrigin, runtimeData }: AdminDashboardProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<AdminRangeKey>('24h');
  const [search, setSearch] = useState('');
  const [utmChannel, setUtmChannel] = useState(0);
  const [utmCampaign, setUtmCampaign] = useState('launch_202608');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const snapshot = runtimeData.ranges[range];
  const productSnapshot = runtimeData.productRanges[range];
  const feedbackSnapshot = runtimeData.feedbackRanges[range];
  const productStepMax = Math.max(1, ...productSnapshot.steps.map((step) => step.count));
  const selectedUtmChannel = utmChannels[utmChannel];
  const utmUrl = `${siteOrigin}/?${new URLSearchParams({
    utm_source: selectedUtmChannel.source,
    utm_medium: selectedUtmChannel.medium,
    utm_campaign: safeCampaign(utmCampaign),
  }).toString()}`;

  async function copyUtmUrl() {
    try {
      await navigator.clipboard.writeText(utmUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  useGSAP(() => {
    gsap.from('.admin-kpi-card', {
      y: 28,
      opacity: 0,
      duration: 0.75,
      stagger: 0.08,
      ease: 'power3.out',
    });

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

  const visibleRequests = snapshot.requests.filter((item) =>
    `${item.type} ${item.source} ${item.model} ${item.status}`.toLowerCase().includes(search.toLowerCase()),
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
          <a href="#performance"><span>来源与成本</span></a>
          <a href="#product-funnel"><span>产品漏斗</span></a>
          <a href="#requests"><span>请求记录</span></a>
          <a href="#quality"><span>模型质量</span></a>
          <a href="#samples"><span>授权样本</span></a>
          <a href="#feedback"><span>用户反馈</span></a>
          <a href="#credentials"><span>API 密钥</span></a>
          <a href="#settings"><span>系统设置</span></a>
        </nav>

        <div className="admin-sidebar-foot">
          <span className="admin-online-dot" />
          <div><b>匿名指标已启用</b><span>{runtimeData.hasData ? '正在读取真实数据' : '等待首批请求'}</span></div>
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
              {rangeOptions.map((item) => (
                <button key={item.key} className={range === item.key ? 'is-active' : ''} onClick={() => setRange(item.key)}>{item.label}</button>
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
            <div><h2>运行概览</h2><p>{snapshot.label} · 从本次上线后开始累计</p></div>
            <span className="admin-live"><i /> LIVE DATA</span>
          </div>

          <div className="admin-kpi-grid">
            {snapshot.kpis.map((item) => (
              <article className={`admin-kpi-card tone-${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.delta}</small>
                <div className="admin-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
              </article>
            ))}
          </div>
        </section>

        <section id="performance" className="admin-grid-row admin-performance-row">
          <article className="admin-panel admin-performance-panel">
            <div className="admin-panel-head"><div><h2>服务表现与成本</h2><p>按实际处理方统计请求量、成功率、P95 与可估算成本。</p></div><span className="admin-count">{snapshot.providers.length}</span></div>
            <div className="admin-performance-list">
              {snapshot.providers.map((provider) => (
                <div key={provider.key}>
                  <span><b>{provider.label}</b><small>{provider.total} 次请求</small></span>
                  <span><small>成功率</small><b>{provider.successRate === null ? '—' : `${provider.successRate.toFixed(1)}%`}</b></span>
                  <span><small>P95</small><b>{provider.p95}</b></span>
                  <span><small>估算成本</small><b>{provider.cost}</b></span>
                </div>
              ))}
              {!snapshot.providers.length && <div className="admin-empty-state">暂无服务调用记录。</div>}
            </div>
            <div className="admin-token-strip">
              <span><small>输入 Token</small><b>{snapshot.usage.inputTokens.toLocaleString('zh-CN')}</b></span>
              <span><small>输出 Token</small><b>{snapshot.usage.outputTokens.toLocaleString('zh-CN')}</b></span>
              <span><small>缓存命中</small><b>{snapshot.usage.cacheHitTokens.toLocaleString('zh-CN')}</b></span>
              <span><small>成本覆盖</small><b>{snapshot.usage.costCoverage}</b></span>
            </div>
          </article>

          <article className="admin-panel admin-source-panel">
            <div className="admin-panel-head"><div><h2>输入来源</h2><p>只记录渠道标签，不记录链接、文件名或材料正文。</p></div></div>
            <div className="admin-source-list">
              {snapshot.sources.map((source) => (
                <div key={source.key}>
                  <span><b>{source.label}</b><small>{source.successRate === null ? '尚无结果' : `${source.successRate.toFixed(0)}% 成功`}</small></span>
                  <strong>{source.total}</strong>
                </div>
              ))}
              {!snapshot.sources.length && <div className="admin-empty-state">新请求产生后开始显示来源。</div>}
            </div>
            <p className="admin-cost-note">成本为按当前公开单价计算的估算值，不等同于供应商账单；历史请求没有 Token 用量，会显示“未采集”。</p>
          </article>
        </section>

        <section id="product-funnel" className="admin-grid-row admin-product-row">
          <article className="admin-panel admin-product-panel">
            <div className="admin-panel-head"><div><h2>产品使用漏斗</h2><p>覆盖所有访客的无正文事件次数；重复操作会重复计数，不等同于独立用户。</p></div><span className="admin-live"><i /> LIVE DATA</span></div>
            <div className="admin-product-kpis">
              {productSnapshot.kpis.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></div>)}
            </div>
            <div className="admin-product-funnel">
              {productSnapshot.steps.map((step, index) => (
                <div key={step.key}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <b>{step.label}</b>
                  <i><em style={{ width: `${step.count / productStepMax * 100}%` }} /></i>
                  <strong>{step.count}</strong>
                </div>
              ))}
            </div>
            <div className="admin-product-quality">
              <div><span>分析成功率</span><b>{productSnapshot.quality.analysisSuccessRate === null ? '-' : `${productSnapshot.quality.analysisSuccessRate.toFixed(1)}%`}</b></div>
              <div><span>建议采用率</span><b>{productSnapshot.quality.suggestionAcceptanceRate === null ? '-' : `${productSnapshot.quality.suggestionAcceptanceRate.toFixed(1)}%`}</b></div>
              <div><span>分析失败事件</span><b>{productSnapshot.quality.analysisFailures}</b></div>
            </div>
          </article>

          <article className="admin-panel admin-acquisition-panel">
            <div className="admin-panel-head"><div><h2>推广来源</h2><p>{productSnapshot.acquisition.coverage}</p></div></div>
            <div className="admin-acquisition-list">
              {productSnapshot.acquisition.channels.map((channel) => (
                <div key={channel.key}>
                  <span><b>{channel.label}</b><small>{channel.visits} 次访问 · {channel.starts} 次发起</small></span>
                  <span><strong>{channel.completions}</strong><small>完成分析</small></span>
                  <span><strong>{channel.completionRate === null ? '—' : `${channel.completionRate.toFixed(0)}%`}</strong><small>访问转化</small></span>
                </div>
              ))}
              {!productSnapshot.acquisition.channels.length && <div className="admin-empty-state">带来源的新访问进入后，这里会显示渠道完成率。</div>}
            </div>
            <details className="admin-utm-builder">
              <summary><span>生成渠道链接</span><small>选择渠道并复制</small></summary>
              <div className="admin-utm-controls">
                <label><span>渠道</span><select value={utmChannel} onChange={(event) => { setUtmChannel(Number(event.target.value)); setCopyState('idle'); }}>{utmChannels.map((channel, index) => <option value={index} key={channel.source}>{channel.label}</option>)}</select></label>
                <label><span>Campaign</span><input value={utmCampaign} onChange={(event) => { setUtmCampaign(event.target.value); setCopyState('idle'); }} maxLength={48} /></label>
              </div>
              <div className="admin-utm-output"><input value={utmUrl} readOnly aria-label="生成的 UTM 链接" /><button type="button" onClick={copyUtmUrl}>{copyState === 'copied' ? '已复制' : copyState === 'failed' ? '手动复制' : '复制链接'}</button></div>
              <p>Campaign 会自动转换为小写与下划线格式。只保存渠道标签和当前标签页随机旅程编号。</p>
            </details>
          </article>
        </section>

        <section className="admin-grid-row" id="quality">
          <article className="admin-panel admin-quality-panel">
            <div className="admin-panel-head"><div><h2>模型与流程质量</h2><p>定位问题发生在哪一步，而不是只看最终失败率。</p></div><button>查看详情</button></div>
            <div className="admin-pipeline">
              {snapshot.pipeline.map((item) => (
                <div key={item.label}>
                  <span>{item.label} · {item.total} 次</span>
                  <strong>{item.successRate === null ? '-' : `${item.successRate.toFixed(1)}%`}</strong>
                  <i style={{ '--fill': `${item.successRate ?? 0}%` } as React.CSSProperties} />
                </div>
              ))}
            </div>
            <div className="admin-quality-summary">
              <div><span>主要损耗点</span><b>{snapshot.summary.lossPoint}</b></div>
              <div><span>已转为粘贴</span><b>{snapshot.summary.fallbackCount} 次</b></div>
              <div><span>失败请求</span><b>{snapshot.summary.failureCount} 次</b></div>
            </div>
          </article>

          <article className="admin-panel admin-incident-panel">
            <div className="admin-panel-head"><div><h2>需要关注</h2><p>按出现次数和最近时间排序。</p></div><span className="admin-count">{snapshot.incidents.length}</span></div>
            <div className="admin-incident-stack">
              {snapshot.incidents.map((item) => (
                <div className="admin-incident" key={item.title}>
                  <time>{formatEventTime(item.time)}</time>
                  <div><b>{item.title}</b><p>{item.copy}</p></div>
                  <span>{item.state}</span>
                </div>
              ))}
              {!snapshot.incidents.length && <div className="admin-empty-state">当前时间范围内没有失败请求。</div>}
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
              <thead><tr><th>时间</th><th>请求类型</th><th>来源</th><th>处理方式</th><th>耗时</th><th>估算成本</th><th>状态</th></tr></thead>
              <tbody>
                {visibleRequests.map((item) => (
                  <tr key={item.id}>
                    <td>{formatEventTime(item.time, true)}</td><td>{item.type}</td><td>{item.source}</td><td>{item.model}</td><td>{item.duration}</td><td>{item.cost}</td>
                    <td><span className={item.status === '完成' ? 'status-ok' : 'status-warn'}>{item.status}</span></td>
                  </tr>
                ))}
                {!visibleRequests.length && <tr><td colSpan={7}><div className="admin-empty-state">暂无符合条件的请求记录。</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section id="samples" className="admin-panel admin-samples-panel">
          <div className="admin-panel-head">
            <div><h2>授权分析样本</h2><p>仅展示用户主动勾选后保存的脱敏材料，30 天后自动删除。</p></div>
            <span className="admin-count">{runtimeData.samples.length}</span>
          </div>
          <div className="admin-sample-list">
            {runtimeData.samples.map((sample) => (
              <details className="admin-sample" key={sample.reference}>
                <summary>
                  <span><b>{sample.grade} · {sample.score}/100</b><small>{formatEventTime(sample.time, true)} · {sample.language.toUpperCase()}</small></span>
                  <span>{sample.summary}</span>
                  <code>{sample.reference.slice(0, 8)}</code>
                </summary>
                <div className="admin-sample-materials">
                  <section><h3>脱敏简历</h3><pre>{sample.resumeText}</pre></section>
                  <section><h3>目标 JD</h3><pre>{sample.jdText}</pre></section>
                </div>
                <p>自动删除时间：{formatEventTime(sample.expiresAt, true)} · 自动脱敏可能无法识别所有个人信息，请勿导出或转发。</p>
              </details>
            ))}
            {!runtimeData.samples.length && <div className="admin-empty-state">目前没有用户主动授权保存的样本。</div>}
          </div>
        </section>

        <section className="admin-grid-row admin-bottom-row" id="feedback">
          <article className="admin-panel admin-feedback-panel">
            <div className="admin-panel-head"><div><h2>用户反馈</h2><p>匿名反馈与运行事件分开统计，不保存简历或 JD 内容。</p></div><strong>{feedbackSnapshot.helpfulRate === null ? '-' : `${feedbackSnapshot.helpfulRate.toFixed(0)}%`}</strong></div>
            {feedbackSnapshot.total ? <>
              <div className="admin-feedback-summary"><span><b>{feedbackSnapshot.helpful}</b><small>认为有帮助</small></span><span><b>{feedbackSnapshot.total}</b><small>反馈总数</small></span></div>
              <div className="admin-feedback-list">{feedbackSnapshot.reasons.map((reason) => <div key={reason.key}><span>{reason.label}</span><div><i style={{ width: `${feedbackSnapshot.total ? reason.count / feedbackSnapshot.total * 100 : 0}%` }} /></div><b>{reason.count}</b></div>)}</div>
            </> : <div className="admin-empty-state admin-feedback-empty">暂无反馈。首条真实反馈提交后，这里会自动显示有用率和问题分布。</div>}
          </article>

          <article className="admin-panel admin-settings-panel" id="settings">
            <div className="admin-panel-head"><div><h2>隐私与保护</h2><p>默认少留数据，必要时再扩展。</p></div></div>
            <div className="admin-setting-row is-static"><span><b>材料留存</b><small>仅保存主动授权的脱敏样本，30 天自动删除</small></span><strong>受控</strong></div>
            <div className="admin-setting-row is-static"><span><b>API 限流</b><small>异常请求自动降速</small></span><strong>已开启</strong></div>
            <div className="admin-setting-row is-static"><span><b>管理权限</b><small>ChatGPT 登录与服务端白名单</small></span><strong>已开启</strong></div>
          </article>
        </section>

        <section className="admin-credentials" id="credentials">
          <div className="admin-section-heading">
            <div><h2>API 密钥</h2><p>浏览器永远看不到当前密钥；只有输入新密钥时才会提交替换。</p></div>
            <span className="admin-credential-mode">真实配置状态</span>
          </div>

          <div className="admin-credential-grid">
            <article className="admin-credential-card">
              <div className="admin-provider-head"><span className="admin-provider-mark">DS</span><div><b>DeepSeek</b><small>匹配分析与优化建议</small></div><i>{runtimeData.providers.deepseek.configured ? '已配置' : '未配置'}</i></div>
              <dl><div><dt>模型</dt><dd>{runtimeData.providers.deepseek.model}</dd></div><div><dt>密钥状态</dt><dd>{runtimeData.providers.deepseek.configured ? '服务端 Secret' : '缺少 Secret'}</dd></div><div><dt>最近成功</dt><dd>{formatEventTime(runtimeData.providers.deepseek.lastSuccess)}</dd></div></dl>
              <button className="admin-replace-button" disabled>通过部署环境更换</button>
            </article>

            <article className="admin-credential-card">
              <div className="admin-provider-head"><span className="admin-provider-mark is-zhipu">GLM</span><div><b>智谱 GLM</b><small>扫描件与图片 OCR</small></div><i>{runtimeData.providers.zhipu.configured ? '已配置' : '未配置'}</i></div>
              <dl><div><dt>模型</dt><dd>{runtimeData.providers.zhipu.model}</dd></div><div><dt>密钥状态</dt><dd>{runtimeData.providers.zhipu.configured ? '服务端 Secret' : '缺少 Secret'}</dd></div><div><dt>最近成功</dt><dd>{formatEventTime(runtimeData.providers.zhipu.lastSuccess)}</dd></div></dl>
              <button className="admin-replace-button" disabled>通过部署环境更换</button>
            </article>
          </div>

          <article className="admin-ga-card">
            <div className="admin-ga-copy">
              <span className="admin-provider-mark is-ga">GA4</span>
              <div><b>Google Analytics 4</b><small>记录页面与产品漏斗事件，不发送简历、JD 或文件名；拒绝分析 Cookie 时使用无 Cookie 基础测量。</small></div>
            </div>
            <div className="admin-ga-form">
              <label htmlFor="ga-measurement-id">Measurement ID</label>
              <div>
                <input id="ga-measurement-id" value={runtimeData.providers.ga4.measurementId} readOnly placeholder="G-XXXXXXXXXX" />
                <button disabled>{runtimeData.providers.ga4.configured ? '已启用' : '未配置'}</button>
              </div>
              <small>{runtimeData.providers.ga4.configured ? '当前站点正在发送匿名页面与产品漏斗事件。' : '当前未配置，Google 脚本不会加载。'}</small>
            </div>
          </article>

          <div className="admin-key-security-note">
            <b>安全边界</b>
            <p>不显示旧密钥、不写入浏览器存储、不把密钥放进前端代码。密钥更换继续由受保护的部署环境完成。</p>
          </div>
        </section>

        <footer className="admin-footer">
          <span>ResumeProof Match Admin · Live metrics</span>
          <Link href="/">返回用户端</Link>
        </footer>
      </main>
    </div>
  );
}
