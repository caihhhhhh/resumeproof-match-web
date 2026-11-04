import type { Metadata } from 'next';
import Link from 'next/link';
import { requireChatGPTUser } from '../../chatgpt-auth';
import { BatchOptimizer } from '../../components/batch-optimizer';
import '../../jobs/jobs.css';
import './batch.css';

export const metadata: Metadata = {
  title: '批量优化 | ResumeProof Match',
  description: '用同一份简历，对挑中的岗位逐条生成优化稿。',
  robots: { index: false, follow: false },
};

export default async function BatchPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireChatGPTUser('/match/batch');
  const params = await searchParams;
  const initialIds = (params.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 10);

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
          <Link href="/jobs">岗位库</Link>
          <Link className="is-active" href="/match/batch">批量优化</Link>
          <Link href="/extension">采集扩展</Link>
        </div>
      </nav>

      <main className="jobs-main">
        <header className="jobs-hero">
          <span className="jobs-eyebrow">BATCH / 批量优化</span>
          <h1>一份简历，逐条对准岗位。</h1>
          <p className="jobs-hero-copy">
            先确认简历已经上传，再勾选岗位。系统会为每条岗位单独分析证据、硬条件与改写建议，最后可以导出一份对照报告。
          </p>
          <div className="jobs-hero-actions">
            <Link className="jobs-primary" href="/match/new">上传或更新简历</Link>
            <Link className="jobs-secondary" href="/jobs">回岗位库挑岗位</Link>
          </div>
        </header>

        <BatchOptimizer initialIds={initialIds} />
      </main>
    </div>
  );
}
