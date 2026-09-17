'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminRangeKey, AdminRuntimeData } from '../lib/admin-runtime';


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

function safeUtmValue(value: string, fallback: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._+-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || fallback;
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

function formatSeconds(value: number) {
  if (!value) return '—';
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  return `${minutes}m ${Math.round(value % 60)}s`;
}

function formatPeriodChange(current: number, previous: number) {
  if (!previous) return current ? '上期为 0' : '与上期持平';
  const change = (current - previous) / previous * 100;
  if (Math.abs(change) < 0.05) return '与上期持平';
  return `较上期 ${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function formatPointChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return '暂无同期对比';
  const change = current - previous;
  if (Math.abs(change) < 0.05) return '与上期持平';
  return `较上期 ${change > 0 ? '+' : ''}${change.toFixed(1)} 个百分点`;
}

export default function AdminDashboard({ adminName, adminEmail, signOutPath, siteOrigin, runtimeData }: AdminDashboardProps) {
  const [range, setRange] = useState<AdminRangeKey>('24h');
  const [search, setSearch] = useState('');
  const [utmChannel, setUtmChannel] = useState(0);
  const [utmSource, setUtmSource] = useState('reddit');
  const [utmMedium, setUtmMedium] = useState('community');
  const [utmCampaign, setUtmCampaign] = useState('launch_202608');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const snapshot = runtimeData.ranges[range];
  const productSnapshot = runtimeData.productRanges[range];
  const feedbackSnapshot = runtimeData.feedbackRanges[range];
  const ga4Range = runtimeData.ga4.ranges[range];
  const ga4Current = ga4Range.current;
  const ga4Previous = ga4Range.previous;
  const ga4Kpis = [
    { label: '活跃用户', value: ga4Current.activeUsers.toLocaleString('zh-CN'), delta: formatPeriodChange(ga4Current.activeUsers, ga4Previous.activeUsers) },
    { label: '新用户', value: ga4Current.newUsers.toLocaleString('zh-CN'), delta: formatPeriodChange(ga4Current.newUsers, ga4Previous.newUsers) },
    { label: '会话', value: ga4Current.sessions.toLocaleString('zh-CN'), delta: formatPeriodChange(ga4Current.sessions, ga4Previous.sessions) },
    { label: '浏览量', value: ga4Current.views.toLocaleString('zh-CN'), delta: formatPeriodChange(ga4Current.views, ga4Previous.views) },
    { label: '互动率', value: ga4Current.engagementRate === null ? '—' : `${ga4Current.engagementRate.toFixed(1)}%`, delta: formatPointChange(ga4Current.engagementRate, ga4Previous.engagementRate) },
    { label: '跳出率', value: ga4Current.bounceRate === null ? '—' : `${ga4Current.bounceRate.toFixed(1)}%`, delta: formatPointChange(ga4Current.bounceRate, ga4Previous.bounceRate) },
    { label: '平均会话时长', value: formatSeconds(ga4Current.averageSessionDuration), delta: formatPeriodChange(ga4Current.averageSessionDuration, ga4Previous.averageSessionDuration) },
    { label: '事件 / 关键事件', value: `${ga4Current.eventCount.toLocaleString('zh-CN')} / ${ga4Current.keyEvents.toLocaleString('zh-CN')}`, delta: formatPeriodChange(ga4Current.eventCount, ga4Previous.eventCount) },
  ];
  const productStepMax = Math.max(1, ...productSnapshot.steps.map((step) => step.count));
  const utmUrl = `${siteOrigin}/?${new URLSearchParams({
    utm_source: safeUtmValue(utmSource, 'source'),
    utm_medium: safeUtmValue(utmMedium, 'medium'),
    utm_campaign: safeUtmValue(utmCampaign, 'campaign'),
  }).toString()}`;

  function applyUtmTemplate(index: number) {
    setUtmChannel(index);
    if (index >= 0) {
      setUtmSource(utmChannels[index].source);
      setUtmMedium(utmChannels[index].medium);
    }
    setCopyState('idle');
  }

  async function copyUtmUrl() {
    try {
      await navigator.clipboard.writeText(utmUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  const visibleRequests = snapshot.requests.filter((item) =>
    `${item.type} ${item.source} ${item.model} ${item.status}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand" aria-label="返回 ResumeProof Match 首页">
          <span className="admin-brand-mark">RP</span>
          <span>ResumeProof</span>
        </Link>

        <nav className="admin-nav" aria-label="后台导航">
          <a className="is-active" href="#overview"><span>总览</span></a>
          <a href="#performance"><span>来源与成本</span></a>
          <a href="#product-funnel"><span>产品漏斗</span></a>
          <a href="#ga4-reporting"><span>GA4 数据</span></a>
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
            <div className="admin-panel-head"><div><h2>产品阶段覆盖</h2><p>按访问旅程去重，排除已标记的示例操作和无旅程标识的历史记录；不是严格顺序漏斗或独立用户数。最多读取最近 10,000 条事件。</p></div><span className="admin-live"><i /> LIVE DATA</span></div>
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
            {!!productSnapshot.acquisition.campaigns.length && <details className="admin-campaign-detail">
              <summary><span>活动明细</span><small>{productSnapshot.acquisition.campaigns.length} 组</small></summary>
              <div className="admin-campaign-table-wrap">
                <table>
                  <thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>访问</th><th>发起</th><th>完成</th><th>完成率</th></tr></thead>
                  <tbody>{productSnapshot.acquisition.campaigns.map((item) => <tr key={item.key}>
                    <td>{item.source}</td><td>{item.medium}</td><td>{item.campaign}</td><td>{item.visits}</td><td>{item.starts}</td><td>{item.completions}</td><td>{item.completionRate === null ? '—' : `${item.completionRate.toFixed(0)}%`}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </details>}
            <details className="admin-utm-builder">
              <summary><span>生成渠道链接</span><small>模板或自定义</small></summary>
              <div className="admin-utm-controls">
                <label><span>渠道模板</span><select value={utmChannel} onChange={(event) => applyUtmTemplate(Number(event.target.value))}><option value={-1}>自定义</option>{utmChannels.map((channel, index) => <option value={index} key={channel.source}>{channel.label}</option>)}</select></label>
                <label><span>Source</span><input value={utmSource} onChange={(event) => { setUtmSource(event.target.value); setUtmChannel(-1); setCopyState('idle'); }} maxLength={48} /></label>
                <label><span>Medium</span><input value={utmMedium} onChange={(event) => { setUtmMedium(event.target.value); setUtmChannel(-1); setCopyState('idle'); }} maxLength={48} /></label>
                <label><span>Campaign</span><input value={utmCampaign} onChange={(event) => { setUtmCampaign(event.target.value); setCopyState('idle'); }} maxLength={48} /></label>
              </div>
              <div className="admin-utm-output"><input value={utmUrl} readOnly aria-label="生成的 UTM 链接" /><button type="button" onClick={copyUtmUrl}>{copyState === 'copied' ? '已复制' : copyState === 'failed' ? '手动复制' : '复制链接'}</button></div>
              <p>Source、Medium 和 Campaign 都可以自定义，并会自动转换为小写与下划线格式。</p>
            </details>
          </article>
        </section>

        <section id="ga4-reporting" className="admin-panel admin-ga4-reporting">
          <div className="admin-panel-head">
            <div><h2>Google Analytics 4</h2><p>访客、会话、浏览与渠道数据直接来自 GA4，不包含简历或 JD 内容。</p></div>
            <span className={`admin-ga4-status is-${runtimeData.ga4.status}`}>{runtimeData.ga4.status === 'ready' ? '已连接' : runtimeData.ga4.status === 'error' ? '连接异常' : '待连接'}</span>
          </div>
          {runtimeData.ga4.status === 'ready' ? <>
            <div className="admin-ga4-kpis">
              {ga4Kpis.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.delta}</small></div>)}
            </div>
            <div className="admin-ga4-channel-head"><span>{ga4Range.label}渠道</span><small>Property {runtimeData.ga4.propertyId} · {formatEventTime(runtimeData.ga4.updatedAt, true)} 更新</small></div>
            <div className="admin-ga4-channel-table">
              <table><thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>会话</th><th>用户</th><th>互动率</th><th>关键事件</th></tr></thead>
                <tbody>{ga4Range.channels.map((item) => <tr key={item.key}><td>{item.source}</td><td>{item.medium}</td><td>{item.campaign}</td><td>{item.sessions}</td><td>{item.activeUsers}</td><td>{item.engagementRate === null ? '—' : `${item.engagementRate.toFixed(1)}%`}</td><td>{item.keyEvents}</td></tr>)}</tbody>
              </table>
              {!ga4Range.channels.length && <div className="admin-empty-state">GA4 已连接，{ga4Range.label}暂无渠道数据。</div>}
            </div>
            <div className="admin-ga4-detail-grid">
              <section>
                <div className="admin-ga4-subhead"><b>热门页面</b><small>{ga4Range.label}</small></div>
                <div className="admin-ga4-mini-table"><table><thead><tr><th>页面</th><th>浏览</th><th>用户</th><th>互动</th></tr></thead><tbody>{ga4Range.pages.map((item) => <tr key={item.key}><td title={item.title}><b>{item.path}</b><small>{item.title}</small></td><td>{item.views}</td><td>{item.activeUsers}</td><td>{formatSeconds(item.engagementSeconds)}</td></tr>)}</tbody></table>{!ga4Range.pages.length && <div className="admin-empty-state">暂无页面数据。</div>}</div>
              </section>
              <section>
                <div className="admin-ga4-subhead"><b>主要事件</b><small>{ga4Range.label}</small></div>
                <div className="admin-ga4-mini-table"><table><thead><tr><th>事件</th><th>次数</th><th>用户</th></tr></thead><tbody>{ga4Range.events.map((item) => <tr key={item.key}><td><b>{item.name}</b></td><td>{item.count}</td><td>{item.users}</td></tr>)}</tbody></table>{!ga4Range.events.length && <div className="admin-empty-state">暂无事件数据。</div>}</div>
              </section>
              <section>
                <div className="admin-ga4-subhead"><b>设备</b><small>{ga4Range.label}</small></div>
                <div className="admin-ga4-mini-table"><table><thead><tr><th>设备</th><th>用户</th><th>会话</th><th>互动率</th></tr></thead><tbody>{ga4Range.devices.map((item) => <tr key={item.key}><td><b>{item.device}</b></td><td>{item.activeUsers}</td><td>{item.sessions}</td><td>{item.engagementRate === null ? '—' : `${item.engagementRate.toFixed(1)}%`}</td></tr>)}</tbody></table>{!ga4Range.devices.length && <div className="admin-empty-state">暂无设备数据。</div>}</div>
              </section>
              <section>
                <div className="admin-ga4-subhead"><b>国家和地区</b><small>{ga4Range.label}</small></div>
                <div className="admin-ga4-mini-table"><table><thead><tr><th>地区</th><th>用户</th><th>会话</th></tr></thead><tbody>{ga4Range.countries.map((item) => <tr key={item.key}><td><b>{item.country}</b></td><td>{item.activeUsers}</td><td>{item.sessions}</td></tr>)}</tbody></table>{!ga4Range.countries.length && <div className="admin-empty-state">暂无地区数据。</div>}</div>
              </section>
            </div>
          </> : <div className="admin-ga4-connect-state">
            <div><span>01</span><b>填写数字 Property ID</b></div>
            <div><span>02</span><b>启用 Analytics Data API</b></div>
            <div><span>03</span><b>授予服务账号查看权限</b></div>
            <p>{runtimeData.ga4.message}</p>
          </div>}
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
