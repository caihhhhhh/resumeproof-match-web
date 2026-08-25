'use client';

import type { MatchAnalysis } from '../lib/match-analysis';

export type SuggestionDecision = 'pending' | 'accepted' | 'editing' | 'skipped';

type Props = {
  analysis: MatchAnalysis;
  language: 'zh' | 'en';
  decisions: Record<string, SuggestionDecision>;
  notes: Record<string, string>;
  onDecision: (id: string, decision: SuggestionDecision) => void;
  onNote: (id: string, note: string) => void;
  onBack: () => void;
  onBuildDraft: () => void;
};

export function OptimizationReview({ analysis, language, decisions, notes, onDecision, onNote, onBack, onBuildDraft }: Props) {
  const suggestions = analysis.suggestions;
  const accepted = suggestions.filter((item) => decisions[item.id] === 'accepted').length;
  const skipped = suggestions.filter((item) => decisions[item.id] === 'skipped').length;
  const pending = suggestions.length - accepted - skipped;
  const reviewComplete = pending === 0;
  const text = language === 'zh' ? {
    eyebrow: 'AI 改写建议', title: '只处理真正值得改的地方。',
    body: '每条建议都保留原文、建议版本和修改理由。没有事实充分的改写时，系统不会为了凑数硬改。',
    accepted: '已采用', pending: '待处理', skipped: '已跳过', original: '简历原文', proposal: '建议版本', reason: '原文问题与调整逻辑', impact: '预期作用', requirement: '对应 JD',
    adopt: '直接采用', edit: '修改后采用', confirmEdit: '确认采用修改版', skip: '跳过', factRequired: '这条涉及新增事实，不能直接采用。请先按真实情况修改。',
    section: '建议位置', back: '返回修改材料', next: '进入完整文字审核稿', ready: '建议已处理，可以审核完整文字稿。',
    needMore: '请先处理全部建议；可以采用、修改后采用或跳过。', empty: 'AI 没有找到值得改写且能由原文支持的内容。无需为了匹配而硬改。',
  } : {
    eyebrow: 'AI rewrite suggestions', title: 'Change only what is worth changing.',
    body: 'Every suggestion keeps the source, proposed version, and rationale. The system will not force rewrites when the evidence does not support them.',
    accepted: 'Adopted', pending: 'Pending', skipped: 'Skipped', original: 'Original resume text', proposal: 'Suggested version', reason: 'Source issue and revision logic', impact: 'Expected impact', requirement: 'Related JD requirement',
    adopt: 'Adopt', edit: 'Edit and adopt', confirmEdit: 'Adopt edited version', skip: 'Skip', factRequired: 'This change needs an additional fact. Edit it to reflect the truth before adopting.',
    section: 'Suggested location', back: 'Back to materials', next: 'Open the full text draft', ready: 'Suggestions reviewed. The full draft is ready.',
    needMore: 'Review every suggestion. You may adopt, edit, or skip each one.', empty: 'AI found no worthwhile rewrite that could be supported by the source text. Do not force a change for matching.',
  };

  function adopt(id: string, revisedText: string) {
    onNote(id, revisedText);
    onDecision(id, 'accepted');
  }

  function beginEditing(id: string, revisedText: string) {
    if (!(id in notes)) onNote(id, revisedText);
    onDecision(id, 'editing');
  }

  return (
    <div className="optimization-review">
      <header className="optimization-heading">
        <div><span>{text.eyebrow}</span><h1>{text.title}</h1><p>{text.body}</p></div>
        {suggestions.length > 0 && <p className="optimization-progress">{pending > 0 ? `${pending} ${text.pending}` : `${accepted} ${text.accepted} · ${skipped} ${text.skipped}`}</p>}
      </header>

      {suggestions.length ? <div className="suggestion-list">
        {suggestions.map((suggestion, index) => {
          const decision = decisions[suggestion.id] ?? 'pending';
          const editValue = notes[suggestion.id] ?? suggestion.revisedText;
          return (
            <article className={`suggestion-card is-${decision}`} key={suggestion.id}>
              <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{suggestion.kind === 'fact_check' ? text.factRequired : text.section}</small><h2>{suggestion.targetSection}</h2></div></header>
              <div className="rewrite-comparison">
                <section><span>{text.original}</span><p>{suggestion.originalText}</p></section>
                <section><span>{text.proposal}</span><p>{suggestion.revisedText || text.factRequired}</p></section>
              </div>
              <div className="rewrite-context">
                <p><span>{text.reason}</span>{suggestion.rationale}</p>
                <p><span>{text.impact}</span>{suggestion.expectedImpact}</p>
                <p><span>{text.requirement}</span>{suggestion.relatedRequirement}</p>
              </div>
              {suggestion.requiresFact && decision !== 'editing' && decision !== 'accepted' && <p className="fact-warning">{text.factRequired}</p>}
              {(decision === 'editing' || decision === 'accepted') && (
                <label className="rewrite-editor"><span>{text.proposal}</span><textarea value={editValue} rows={4} onChange={(event) => onNote(suggestion.id, event.target.value)} /></label>
              )}
              <div className="suggestion-actions">
                {!suggestion.requiresFact && decision !== 'editing' && <button type="button" className={decision === 'accepted' ? 'is-selected' : ''} onClick={() => adopt(suggestion.id, suggestion.revisedText)}>{text.adopt}</button>}
                <button type="button" className={decision === 'editing' ? 'is-selected' : ''} onClick={() => decision === 'editing' ? adopt(suggestion.id, editValue) : beginEditing(suggestion.id, suggestion.revisedText)} disabled={decision === 'editing' && !editValue.trim()}>{decision === 'editing' ? text.confirmEdit : text.edit}</button>
                <button type="button" className={decision === 'skipped' ? 'is-selected' : ''} onClick={() => onDecision(suggestion.id, 'skipped')}>{text.skip}</button>
              </div>
            </article>
          );
        })}
      </div> : <p className="empty-suggestions">{text.empty}</p>}

      {suggestions.length > 0 && <p className={`review-state${reviewComplete ? ' is-ready' : ''}`}>{reviewComplete ? text.ready : text.needMore}</p>}
      <div className="review-actions">
        <button type="button" className="review-back" onClick={onBack}><span aria-hidden="true">←</span>{text.back}</button>
        <button type="button" disabled={!reviewComplete} title={reviewComplete ? text.next : text.needMore} onClick={onBuildDraft}>{text.next}<span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}
