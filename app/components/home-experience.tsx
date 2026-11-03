'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useLanguage } from './language-context';
import { SiteFooter } from './site-footer';
import { trackEvent } from '../lib/analytics';
import { getDemoPreview } from '../lib/demo-materials';
import './home-experience.css';

gsap.registerPlugin(useGSAP);

export default function HomeExperience({ initialLanguage }: { initialLanguage?: 'zh' | 'en' }) {
  const root = useRef<HTMLElement>(null);
  const context = useLanguage();
  const [override, setOverride] = useState(initialLanguage);
  const language = override ?? context.language;
  const toggleLanguage = () => { const next = language === 'zh' ? 'en' : 'zh'; setOverride(next); context.setLanguage(next); };
  const start = () => { context.setLanguage(language); trackEvent('match_started', { source: 'homepage' }); };
  const zh = language === 'zh';
  const [view, setView] = useState(1);
  const [adopted, setAdopted] = useState(false);
  const example = getDemoPreview(language);
  const original = example.suggestion.originalText;
  const revised = example.suggestion.revisedText;
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.rp-intro > *', { y: 16, opacity: 0, duration: .7, stagger: .09, ease: 'power2.out' });
    });
    return () => mm.revert();
  }, { scope: root });
  useGSAP(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    root.current?.querySelectorAll<HTMLElement>('.rp-paper').forEach((paper, index) => {
      gsap.to(paper, { autoAlpha: index === view ? 1 : 0, rotationY: reduce || mobile ? 0 : index === view ? 0 : index < view ? -105 : 105, x: reduce ? 0 : index === view ? 0 : index < view ? -22 : 22, z: reduce || mobile ? 0 : index === view ? 0 : -90, duration: reduce ? 0 : .65, ease: 'power3.inOut', overwrite: true });
    });
  }, { scope: root, dependencies: [view, language] });
  useGSAP(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (!active) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo('.rp-paper-stack', { scale: .94, rotationX: 3, y: 8 }, {
          scale: 1, rotationX: 0, y: 0, ease: 'none',
          scrollTrigger: { trigger: root.current?.querySelector('.rp-paper-anchor'), start: 'clamp(top 85%)', end: 'top 15%', scrub: .35, invalidateOnRefresh: true },
        });
        gsap.fromTo('.rp-context', { y: 26, opacity: .55 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: root.current?.querySelector('.rp-stage'), start: 'top 90%', end: 'top 35%', scrub: .5 } });
      });
      const observer = new ResizeObserver(() => ScrollTrigger.refresh());
      if (root.current) observer.observe(root.current);
      dispose = () => { observer.disconnect(); mm.revert(); };
    });
    return () => { active = false; dispose?.(); };
  }, { scope: root });
  const { contextSafe } = useGSAP({ scope: root });
  const tilt = contextSafe((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    gsap.to('.rp-documents', { rotationY: ((event.clientX - box.left) / box.width - .5) * 8, rotationX: -((event.clientY - box.top) / box.height - .5) * 6, duration: .7, overwrite: true });
  });
  const untilt = contextSafe(() => gsap.to('.rp-documents', { rotationX: 0, rotationY: 0, duration: .7, overwrite: true }));

  return <main className="rp-concept" lang={zh ? 'zh-CN' : 'en'} ref={root}>
    <nav className="rp-nav" aria-label={zh ? '主导航' : 'Main navigation'}>
      <Link className="rp-brand" href="/">ResumeProof<span> Match</span></Link>
      <div><a href="#how">{zh ? '如何使用' : 'How it works'}</a><Link href={zh ? '/guide' : '/en/guide'}>{zh ? '匹配方法' : 'Our method'}</Link><button onClick={toggleLanguage} aria-label={zh ? 'Switch to English' : '切换为中文'}>{zh ? 'EN' : '中文'}</button><Link className="rp-nav-start" href="/match/new" onClick={start}>{zh ? '开始使用' : 'Get started'}</Link></div>
    </nav>
    <section className="rp-hero">
      <div className="rp-intro"><p className="rp-eyebrow">{zh ? '简历 × 目标岗位' : 'YOUR EXPERIENCE × YOUR NEXT ROLE'}</p><h1>{zh ? <>把合适的经历，<br/><span>写到对的地方。</span></> : <>The right experience.<br/><span>Clearly in view.</span></>}</h1><p className="rp-description">{zh ? <>对照 JD 找差距，逐条看清修改理由。<br/>保留真实经历，审核后再导出。</> : <>Compare your resume with the role.<br/>Choose your edits. Review before export.</>}</p><div className="rp-actions"><Link className="rp-primary" href="/match/new" onClick={start}>{zh ? '开始优化简历' : 'Refine your resume'}</Link><Link className="rp-text-link" href="/match/new?demo=1" onClick={() => { context.setLanguage(language); trackEvent('demo_entry_clicked', { source: 'homepage' }); }}>{zh ? '体验完整示例' : 'Try the example'} <span aria-hidden="true">↗</span></Link></div></div>
      <div className="rp-stage" onPointerMove={tilt} onPointerLeave={untilt}>
        <div className="rp-documents">
          <aside className="rp-context" aria-label={zh ? '修改依据' : 'Edit rationale'}>
            <span className="rp-context-label">{zh ? '目标岗位 · 增长营销经理' : 'Target role · Growth Marketing Manager'}</span>
            <p className="rp-requirement">{zh ? '岗位要求：将数据分析转化为优化动作。' : 'Requirement: Turn analysis into optimization actions.'}</p>
            <details className="rp-reason"><summary>{zh ? '为什么这样改？' : 'Why this edit?'}</summary><p>{example.suggestion.rationale}</p><p className="rp-preserved">{zh ? '保留原有 28% 结果，不添加新职责。' : 'Keeps the 28% result without adding responsibilities.'}</p></details>
          </aside>
          <div className="rp-paper-anchor"><div className="rp-paper-stack">{[0, 1].map((face) => <article key={face} className="rp-paper" aria-hidden={face !== view} aria-label={zh ? '简历与修改示例' : 'Resume edit example'}><header><span>RESUME</span><span>↗</span></header><div className="rp-document-content"><h2>{zh ? '林晨' : 'Alex Lin'}</h2><p className="rp-role">{zh ? '增长营销 · 内容与渠道' : 'Growth Marketing · Content & Channels'}</p><div className="rp-paper-rule"/><h3>{zh ? '工作经历' : 'Experience'}</h3><div className="rp-job-title"><strong>Example Labs</strong><span>2023 — 2026</span></div><p>{zh ? '独立推进渠道 Campaign，协调设计与数据团队完成素材上线及效果复盘。' : 'Ran channel campaigns with design and analytics teams, from creative launch to performance review.'}</p><div className="rp-edit-pair"><span>{zh ? '原文' : 'Original'}</span><p>{original}</p>{face === 1 && <div className="rp-highlight"><span>{zh ? '建议表达' : 'Suggested wording'}</span><p>{revised}</p></div>}</div></div><footer>{zh ? '演示内容 · 非真实求职者资料' : 'Illustrative example · Not a real candidate'}</footer></article>)}</div></div>
        </div>
      </div>
      <div className="rp-demo-bar"><div className="rp-demo-controls" role="group" aria-label={zh ? '切换演示版本' : 'Example version'}>{[zh ? '查看原文' : 'Original', zh ? '对比修改' : 'Compare edit'].map((label, i) => <button key={label} aria-pressed={view === i} onClick={() => setView(i)}>{label}</button>)}</div><button className="rp-adopt" aria-pressed={adopted} onClick={() => { setAdopted(!adopted); setView(adopted ? 0 : 1); }}>{adopted ? (zh ? '撤销采用' : 'Undo adoption') : (zh ? '试试采用建议' : 'Try adopting the edit')}</button></div>
      <p className="rp-caption" role="status">{adopted ? (zh ? '已采用示例建议，仅影响演示。' : 'Example edit adopted. This only changes the demo.') : (zh ? '交互示例，不会修改你的简历。' : 'Interactive example. Your resume is unchanged.')}</p>
    </section>
    <section className="rp-keep" aria-labelledby="keep-title"><div><span>{zh ? '不改，也是一种建议' : 'SOMETIMES, KEEP THE ORIGINAL'}</span><h2 id="keep-title">{zh ? '已经清楚的经历，就保留。' : 'Clear evidence needs no rewrite.'}</h2></div><div><p>{example.keptText}</p><small>{zh ? '工具、分析对象与后续动作都有依据。不为改写而改写。' : 'The tools, analysis, and next action are already clear. No rewrite for its own sake.'}</small></div></section>
    <section className="rp-how" id="how"><h2>{zh ? '从材料，到可投递的简历。' : 'From source material to a resume you can send.'}</h2><div className="rp-steps">{(zh ? [['添加简历与岗位','上传文件，或粘贴文字。先把你的经历和目标放在一起。'],['找到值得改的地方','看清匹配依据、缺失的信息，以及每一条修改的原因。'],['审核，再导出','采用你认可的建议，编辑完整简历，再导出 PDF 或 DOCX。']] : [['Bring both sides','Upload or paste your resume and the role you want.'],['See what matters','Review supporting evidence, gaps, and the reason behind each edit.'],['Review. Make it yours.','Choose your edits, check the full draft, and export PDF or DOCX.']]).map(([title, body], i) => <article key={title}><span className="rp-step-number">{i + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>

    <section className="rp-close"><h2><span>{zh ? '下一份机会' : 'Make room for'}</span><span>{zh ? '从这里开始' : 'your next opportunity'}</span></h2><Link className="rp-primary" href="/match/new" onClick={start}>{zh ? '开始优化简历' : 'Refine your resume'}</Link><p>{zh ? '分析时，简历与 JD 文字会发送至 AI 服务。' : 'Analysis sends your resume and job description text to AI services.'}<br/><Link href="/privacy">{zh ? '了解数据如何处理' : 'How your data is handled'}</Link></p></section>
    <SiteFooter forceLanguage={language} />
  </main>;
}
