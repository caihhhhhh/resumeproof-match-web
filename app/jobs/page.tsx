import type { Metadata } from 'next';
import Link from 'next/link';
import { chatGPTSignOutPath, requireChatGPTUser } from '../chatgpt-auth';
import { JobsSyncToken } from '../components/jobs-sync-token';
import { countSavedJobs, countSavedJobsBySite, listSavedJobs } from '../lib/saved-jobs';
import './jobs.css';

export const metadata: Metadata = {
  title: '岗位库 | ResumeProof Match',
  description: '把 BOSS、智联、猎聘 上看到的岗位收进你的账号，再用同一份简历逐条匹配。',
  robots: { index: false, follow: false },
};

const SITE_LABELS: Record<string, string> = {
  boss: 'BOSS直聘',
  zhaopin: '智联招聘',
  liepin: '猎聘',
  official: '公司官网',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  jobpro: '校招官网',
};

const PAGE_SIZE = 30;

function formatDay(ms: number) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

function buildQuery(input: { q?: string; site?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set('q', input.q);
  if (input.site) params.set('site', input.site);
  if (input.page && input.page > 1) params.set('page', String(input.page));
  const query = params.toString();
  return query ? `/jobs?${query}` : '/jobs';
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; site?: string; page?: string }>;
}) {
  const user = await requireChatGPTUser('/jobs');
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const site = (params.site ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [jobs, total, siteCounts] = await Promise.all([
    listSavedJobs(user.userId, { q, site, limit: PAGE_SIZE, offset }),
    countSavedJobs(user.userId, { q, site }),
    countSavedJobsBySite(user.userId),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allCount = Object.values(siteCounts).reduce((sum, value) => sum + value, 0);
  const activeSites = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="jobs-shell">
      <nav className="jobs-nav">
        <Link className="jobs-brand" href="/">
          <span>RP</span>
          <b>ResumeProof</b>
        </Link>
        <div className="jobs-nav-links">
          <Link href="/match/new">新建匹配</Link>
          <Link href="/guide">使用指南</Link>
          <Link className="is-active" href="/jobs">岗位库</Link>
          <Link href="/match/batch">批量优化</Link>
          <Link href="/extension">采集扩展</Link>
          <a href={chatGPTSignOutPath('/')}>退出</a>
        </div>
      </nav>

      <main className="jobs-main">
        <header className="jobs-hero">
          <span className="jobs-eyebrow">SAVED JOBS / 岗位库</span>
          <h1>先把岗位收进来，再决定改哪一版简历。</h1>
          <p>
            平台上的岗位靠你在浏览器里点一下采集，登录态不会离开你的设备；收到的岗位只属于你。
            目前共 <strong>{allCount}</strong> 条，其中 {activeSites.length || 0} 个来源。
          </p>
          <div className="jobs-hero-actions">
            <Link className="jobs-primary" href="/extension">下载采集扩展</Link>
            <Link className="jobs-secondary" href="/match/new">直接匹配现有 JD</Link>
            <Link className="jobs-secondary" href="/match/batch">批量优化</Link>
          </div>
        </header>

        <form className="jobs-toolbar" action="/jobs" method="get">
          {site ? <input type="hidden" name="site" value={site} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜岗位、公司，比如「海外投放」「MiniMax」"
            aria-label="搜索已保存的岗位"
          />
          <button type="submit">搜索</button>
          {q || site ? <Link className="jobs-clear" href="/jobs">清除</Link> : null}
        </form>

        {activeSites.length > 1 ? (
          <nav className="jobs-filters" aria-label="按来源筛选">
            <Link className={site ? '' : 'is-active'} href={buildQuery({ q })}>全部 {allCount}</Link>
            {activeSites.map(([key, count]) => (
              <Link
                className={site === key ? 'is-active' : ''}
                href={buildQuery({ q, site: site === key ? '' : key })}
                key={key}
              >
                {SITE_LABELS[key] ?? key} {count}
              </Link>
            ))}
          </nav>
        ) : null}

        <JobsSyncToken />

        {jobs.length === 0 ? (
          <section className="jobs-empty">
            <h2>{q || site ? '没有匹配的岗位' : '岗位库还是空的'}</h2>
            <p>{q || site ? '换个关键词或来源试试，或者清除筛选。' : '两种方式开始：'}</p>
            <div className="jobs-empty-grid">
              <div>
                <b>01 / 采集平台岗位</b>
                <p>在 BOSS、智联、猎聘 搜索后点「采集本页」，用上面的令牌同步进来。<Link href="/extension">安装扩展</Link>。</p>
              </div>
              <div>
                <b>02 / 直接匹配</b>
                <p>已经有 JD？<Link href="/match/new">去新建一次匹配</Link>，判断清楚再决定投不投。</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="jobs-list" aria-label="已保存的岗位">
            {jobs.map((job) => (
              <article className="jobs-card" key={job.id}>
                <div className="jobs-card-top">
                  <span className={`jobs-badge jobs-badge-${job.site}`}>{SITE_LABELS[job.site] ?? job.site}</span>
                  <span className="jobs-date">{formatDay(job.captured_at_ms)} 收录</span>
                </div>
                <h2><a href={job.url} target="_blank" rel="noreferrer noopener">{job.title}</a></h2>
                <p className="jobs-meta">
                  {[job.company, job.salary, job.location].filter(Boolean).join(' · ') || '信息待补充'}
                </p>
                {job.jd ? <p className="jobs-jd">{job.jd.slice(0, 220)}{job.jd.length > 220 ? '…' : ''}</p> : null}
                <div className="jobs-actions">
                  <a href={job.url} target="_blank" rel="noreferrer noopener">打开原岗位</a>
                  <Link href="/match/new">用这份 JD 匹配</Link>
                </div>
              </article>
            ))}
          </section>
        )}

        {pages > 1 ? (
          <nav className="jobs-pager" aria-label="分页">
            {page > 1
              ? <Link href={buildQuery({ q, site, page: page - 1 })}>上一页</Link>
              : <span />}
            <span>{page} / {pages}</span>
            {page < pages
              ? <Link href={buildQuery({ q, site, page: page + 1 })}>下一页</Link>
              : <span />}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
