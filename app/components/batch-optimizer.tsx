'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MatchAnalysis } from '../lib/match-analysis';

const BASE_RESUME_KEY = 'resumeproof-base-resume-v1';
const DRAFT_KEY = 'resumematch-current-draft';
const MAX_BATCH = 10;

type SavedJob = {
  id: string;
  site: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  url: string;
  jd: string;
  captured_at_ms: number;
};

type JobResult = {
  job: SavedJob;
  analysis?: MatchAnalysis;
  error?: string;
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

const DECISION_LABELS: Record<MatchAnalysis['decision'], string> = {
  apply: '可以直接投递',
  review_first: '确认后再投递',
  skip: '暂不建议投递',
};

function readStoredResume(): string {
  try {
    const base = window.localStorage.getItem(BASE_RESUME_KEY);
    if (base) {
      const parsed = JSON.parse(base) as { text?: unknown };
      if (typeof parsed.text === 'string' && parsed.text.trim().length >= 40) return parsed.text;
    }
    const draft = window.sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      const parsed = JSON.parse(draft) as { resumeText?: unknown };
      if (typeof parsed.resumeText === 'string' && parsed.resumeText.trim().length >= 40) return parsed.resumeText;
    }
  } catch {
    // Storage may be blocked; the paste box still works.
  }
  return '';
}

function composeJd(job: SavedJob) {
  const head = [job.title, [job.company, job.location, job.salary].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  const body = job.jd && job.jd.trim().length >= 40 ? job.jd.trim() : '';
  return body ? `${head}\n\n${body}` : head;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}

function buildReport(results: JobResult[]) {
  const sections = results.map(({ job, analysis, error }) => {
    const head = `<h2>${escapeHtml(job.title)}</h2>
      <p class="meta">${escapeHtml([job.company, job.salary, job.location, SITE_LABELS[job.site] ?? job.site].filter(Boolean).join(' · '))}</p>
      <p class="meta"><a href="${escapeHtml(job.url)}">${escapeHtml(job.url)}</a></p>`;
    if (!analysis) return `<section>${head}<p class="error">分析失败：${escapeHtml(error ?? '未知错误')}</p></section>`;
    const suggestions = analysis.suggestions
      .map((item) => `<li><b>${escapeHtml(item.targetSection)}</b>：${escapeHtml(item.rationale)}<br /><s>${escapeHtml(item.originalText)}</s><br /><ins>${escapeHtml(item.revisedText)}</ins></li>`)
      .join('');
    const gaps = analysis.missingTerms.length
      ? `<p><b>未覆盖关键词：</b>${escapeHtml(analysis.missingTerms.join('、'))}</p>`
      : '';
    return `<section>
      ${head}
      <p class="score">${analysis.overall} / 100 · ${analysis.grade} · ${DECISION_LABELS[analysis.decision]}</p>
      <p>${escapeHtml(analysis.summary)}</p>
      ${gaps}
      ${suggestions ? `<ol>${suggestions}</ol>` : '<p>没有需要改写的完整句子。</p>'}
    </section>`;
  });
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>ResumeProof 批量匹配报告</title>
  <style>
    body{font:15px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:860px;margin:48px auto;padding:0 24px;color:#111}
    h1{font-size:26px} section{border-top:1px solid #ddd;padding:20px 0}
    .meta{color:#666;font-size:13px;margin:4px 0}
    .score{font-weight:700;margin:12px 0}
    .error{color:#b42318}
    s{color:#999} ins{color:#0a7a3d;text-decoration:none}
    li{margin:10px 0}
  </style>
  <h1>ResumeProof 批量匹配报告</h1>
  <p class="meta">生成于 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · 共 ${results.length} 条岗位</p>
  ${sections.join('')}
  </html>`;
}

export function BatchOptimizer({ initialIds }: { initialIds: string[] }) {
  const [jobs, setJobs] = useState<SavedJob[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));
  const [resume, setResume] = useState('');
  const [resumeKnown, setResumeKnown] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, title: '' });
  const [results, setResults] = useState<JobResult[]>([]);

  useEffect(() => {
    // Reading localStorage has to happen after mount, so the initial server HTML stays stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResume(readStoredResume());
    setResumeKnown(true);
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/jobs?limit=100');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { jobs?: SavedJob[] };
        if (!cancelled) setJobs(data.jobs ?? []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : '岗位列表加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      if (resume.trim().length >= 40) {
        window.localStorage.setItem(BASE_RESUME_KEY, JSON.stringify({ text: resume, savedAt: new Date().toISOString() }));
      }
    } catch {
      // Non-fatal.
    }
  }, [resume]);

  const chosen = useMemo(() => (jobs ?? []).filter((job) => selected.has(job.id)), [jobs, selected]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BATCH) next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set((jobs ?? []).filter((job) => job.jd.trim().length >= 80).slice(0, MAX_BATCH).map((job) => job.id)));
  }, [jobs]);

  async function runBatch() {
    if (running || chosen.length === 0 || resume.trim().length < 40) return;
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: chosen.length, title: chosen[0]?.title ?? '' });
    const collected: JobResult[] = [];
    for (let index = 0; index < chosen.length; index += 1) {
      const job = chosen[index];
      setProgress({ done: index, total: chosen.length, title: job.title });
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 90_000);
      try {
        const response = await fetch('/api/match/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText: resume, jdText: composeJd(job), language: 'zh', sampleConsent: false }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { analysis?: MatchAnalysis; error?: string };
        if (!response.ok || !data.analysis) {
          collected.push({ job, error: data.error ?? `HTTP ${response.status}` });
        } else {
          collected.push({ job, analysis: data.analysis });
        }
      } catch (error) {
        collected.push({ job, error: error instanceof Error ? error.message : '请求失败' });
      } finally {
        window.clearTimeout(timer);
      }
      setResults([...collected]);
    }
    setProgress({ done: chosen.length, total: chosen.length, title: '' });
    setRunning(false);
  }

  function downloadReport() {
    if (results.length === 0) return;
    const blob = new Blob([buildReport(results)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `resumeproof-batch-${new Date().toISOString().slice(0, 10)}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const hasResume = resume.trim().length >= 40;

  return (
    <div className="batch">
      <section className={`batch-panel ${hasResume ? 'is-ready' : 'is-missing'}`}>
        <div>
          <b>{hasResume ? '简历已就绪' : '还没有简历'}</b>
          <p>
            {hasResume
              ? `已读取本机保存的基础简历，约 ${resume.length} 字。分析时只把简历与 JD 文字发给 AI 服务。`
              : '先上传一次简历（会保存在本机），或者直接把简历文字粘贴到下面。'}
          </p>
        </div>
        <div className="batch-panel-actions">
          <a className="jobs-secondary" href="/match/new">上传简历</a>
          <button className="jobs-secondary" type="button" onClick={() => setManualOpen((open) => !open)}>
            {manualOpen ? '收起粘贴框' : '粘贴简历文字'}
          </button>
        </div>
        {manualOpen || (!hasResume && resumeKnown) ? (
          <textarea
            className="batch-textarea"
            value={resume}
            onChange={(event) => setResume(event.target.value)}
            placeholder="把完整简历文字粘贴到这里……"
            rows={8}
          />
        ) : null}
      </section>

      <section className="batch-panel">
        <div className="batch-head">
          <div>
            <b>挑选岗位</b>
            <p>最多一批 {MAX_BATCH} 条，已选 {selected.size} 条。岗位来自你的岗位库。</p>
          </div>
          <div className="batch-panel-actions">
            <button className="jobs-clear" type="button" onClick={selectAll} disabled={!jobs || jobs.length === 0}>选前 10 条</button>
            <button className="jobs-clear" type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>清空</button>
          </div>
        </div>

        {loadError ? <p className="batch-error">岗位列表加载失败：{loadError}</p> : null}
        {jobs === null ? <p className="batch-muted">正在加载岗位库…</p> : null}
        {jobs && jobs.length === 0 ? (
          <p className="batch-muted">
            岗位库还是空的。可以先去 <a href="/jobs">岗位库</a> 采集，或者 <a href="/match/new">直接粘贴 JD 匹配</a>。
          </p>
        ) : null}

        <div className="batch-grid">
          {(jobs ?? []).map((job) => {
            const active = selected.has(job.id);
            const hasJd = job.jd.trim().length >= 80;
            const blocked = !active && (selected.size >= MAX_BATCH || !hasJd);
            return (
              <label className={`batch-job ${active ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''}`} key={job.id}>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={blocked || running}
                  onChange={() => toggle(job.id)}
                />
                <span className={`jobs-badge jobs-badge-${job.site}`}>{SITE_LABELS[job.site] ?? job.site}</span>
                <b>{job.title}</b>
                <span className="batch-job-meta">{[job.company, job.salary, job.location].filter(Boolean).join(' · ') || '信息待补充'}</span>
                {hasJd ? null : <span className="batch-job-meta batch-job-warn">还没抓到 JD，打开原岗位页采集一次详情</span>}
              </label>
            );
          })}
        </div>
      </section>

      <section className="batch-panel batch-run">
        <div>
          <b>逐条生成</b>
          <p>
            {running && progress.total > 0
              ? `正在分析 ${Math.min(progress.done + 1, progress.total)} / ${progress.total}：${progress.title}`
              : `将对 ${chosen.length} 条岗位各跑一次证据匹配，用时约 ${Math.max(1, chosen.length) * 15} 秒。`}
          </p>
        </div>
        <div className="batch-panel-actions">
          <button
            className="jobs-primary"
            type="button"
            onClick={runBatch}
            disabled={running || chosen.length === 0 || !hasResume}
          >
            {running ? '分析中…' : `开始批量优化 (${chosen.length})`}
          </button>
          <button className="jobs-secondary" type="button" onClick={downloadReport} disabled={results.length === 0}>
            导出对照报告
          </button>
        </div>
        {!hasResume ? <p className="batch-muted">缺少简历，无法开始。</p> : null}
        {running ? <div className="batch-progress"><span style={{ width: `${progress.total ? ((progress.done + 1) / progress.total) * 100 : 4}%` }} /></div> : null}
      </section>

      {results.length > 0 ? (
        <section className="batch-results">
          <h2>结果</h2>
          {results.map(({ job, analysis, error }) => (
            <article className="batch-result" key={job.id}>
              <header>
                <span className={`jobs-badge jobs-badge-${job.site}`}>{SITE_LABELS[job.site] ?? job.site}</span>
                <b>{job.title}</b>
              </header>
              <p className="batch-muted">{[job.company, job.salary, job.location].filter(Boolean).join(' · ')}</p>
              {analysis ? (
                <>
                  <p className="batch-score">
                    <strong>{analysis.overall}</strong> / 100 · {analysis.grade} · {DECISION_LABELS[analysis.decision]}
                  </p>
                  <p>{analysis.summary}</p>
                  {analysis.suggestions.length > 0 ? (
                    <ul className="batch-suggestions">
                      {analysis.suggestions.map((item) => (
                        <li key={item.id}>
                          <b>{item.targetSection}</b>
                          <p>{item.rationale}</p>
                          <p className="batch-diff"><s>{item.originalText}</s></p>
                          <p className="batch-diff"><ins>{item.revisedText}</ins></p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="batch-muted">没有需要改写的完整句子。</p>}
                </>
              ) : (
                <p className="batch-error">分析失败：{error}</p>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
