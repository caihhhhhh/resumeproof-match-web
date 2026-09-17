'use client';

import type { MatchAnalysis } from '../lib/match-analysis';
import { useState } from 'react';

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
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState<Record<string, SuggestionDecision>>({});
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
    needMore: '仅合并你已采用的建议，其他内容保留原文。', empty: '没有需要改写的内容，可以直接审核原文。',
  } : {
    eyebrow: 'AI rewrite suggestions', title: 'Change only what is worth changing.',
    body: 'Every suggestion keeps the source, proposed version, and rationale. The system will not force rewrites when the evidence does not support them.',
    accepted: 'Adopted', pending: 'Pending', skipped: 'Skipped', original: 'Original resume text', proposal: 'Suggested version', reason: 'Source issue and revision logic', impact: 'Expected impact', requirement: 'Related JD requirement',
    adopt: 'Adopt', edit: 'Edit and adopt', confirmEdit: 'Adopt edited version', skip: 'Skip', factRequired: 'This change needs an additional fact. Edit it to reflect the truth before adopting.',
    section: 'Suggested location', back: 'Back to materials', next: 'Open the full text draft', ready: 'Suggestions reviewed. The full draft is ready.',
    needMore: 'Only adopted edits are merged. All other text stays as written.', empty: 'No rewrite is needed. Continue with your original text.',
  };

  function adopt(id: string, revisedText: string) {
    onNote(id, revisedText);
    onDecision(id, 'accepted');
  }

  function beginEditing(id: string, revisedText: string) {
    setPrevious((value) => ({ ...value, [id]: decisions[id] ?? 'pending' }));
    setEdits((value) => ({ ...value, [id]: notes[id] ?? revisedText }));
    onDecision(id, 'editing');
  }

  return (
    <div className="optimization-review" id="rewrite-suggestions" tabIndex={-1}>
      <header className="optimization-heading">
        <div><span>{text.eyebrow}</span><h1>{text.title}</h1><p>{text.body}</p></div>
        {suggestions.length > 0 && <p className="optimization-progress">{pending > 0 ? `${pending} ${text.pending}` : `${accepted} ${text.accepted} · ${skipped} ${text.skipped}`}</p>}
      </header>

      {suggestions.length ? <div className="suggestion-list">
        {suggestions.map((suggestion, index) => {
          const decision = decisions[suggestion.id] ?? 'pending';
          const editValue = edits[suggestion.id] ?? notes[suggestion.id] ?? suggestion.revisedText;
          return (
            <article className={`suggestion-card is-${decision}`} key={suggestion.id}>
              <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{suggestion.kind === 'fact_check' ? text.factRequired : text.section}</small><h2>{suggestion.targetSection}</h2></div></header>
              <div className="rewrite-comparison">
                <section><span>{text.original}</span><p>{suggestion.originalText}</p></section>
                <section><span>{decision === 'accepted' ? (language === 'zh' ? '已采用版本' : 'Adopted version') : text.proposal}</span><p>{(decision === 'accepted' ? notes[suggestion.id] : suggestion.revisedText) || text.factRequired}</p></section>
              </div>
              <div className="rewrite-context">
                <p><span>{text.reason}</span>{suggestion.rationale}</p>
                <p><span>{text.impact}</span>{suggestion.expectedImpact}</p>
                <p><span>{text.requirement}</span>{suggestion.relatedRequirement}</p>
              </div>
              {suggestion.requiresFact && decision !== 'editing' && decision !== 'accepted' && <p className="fact-warning">{text.factRequired}</p>}
              {decision === 'editing' && (
                <label className="rewrite-editor"><span>{language === 'zh' ? '修改建议 · 保存后才会采用' : 'Edit suggestion · adopt to save'}</span><textarea autoFocus value={editValue} rows={4} onChange={(event) => setEdits((value) => ({ ...value, [suggestion.id]: event.target.value }))} /></label>
              )}
              <div className="suggestion-actions">
                {decision === 'editing' ? <>
                  <button type="button" onClick={() => onDecision(suggestion.id, previous[suggestion.id] ?? 'pending')}>{language === 'zh' ? '取消修改' : 'Cancel'}</button>
                  <button type="button" className="suggestion-primary" disabled={!editValue.trim()} onClick={() => adopt(suggestion.id, editValue.trim())}>{text.confirmEdit}</button>
                </> : decision === 'accepted' || decision === 'skipped' ? <>
                  <span className="suggestion-status" role="status">{decision === 'accepted' ? (language === 'zh' ? '✓ 已采用，将合并到审核稿' : '✓ Adopted for the draft') : (language === 'zh' ? '已保留原文' : 'Original text kept')}</span>
                  {decision === 'accepted' && <button type="button" onClick={() => beginEditing(suggestion.id, suggestion.revisedText)}>{language === 'zh' ? '继续修改' : 'Edit again'}</button>}
                  <button type="button" onClick={() => onDecision(suggestion.id, 'pending')}>{language === 'zh' ? '撤销选择' : 'Undo decision'}</button>
                </> : <>
                  {!suggestion.requiresFact && <button type="button" className="suggestion-primary" onClick={() => adopt(suggestion.id, suggestion.revisedText)}>{text.adopt}</button>}
                  <button type="button" onClick={() => beginEditing(suggestion.id, suggestion.revisedText)}>{text.edit}</button>
                  <button type="button" onClick={() => onDecision(suggestion.id, 'skipped')}>{language === 'zh' ? '保留原文' : 'Keep original'}</button>
                </>}
              </div>
            </article>
          );
        })}
      </div> : <p className="empty-suggestions">{analysis.suggestionStatus === 'unavailable' ? (language === 'zh' ? '匹配报告已完成，改写服务本次未完成。你可以先审核原文，或返回重新分析。' : 'The match report is ready, but rewrites were unavailable. Review the original text or retry analysis.') : text.empty}</p>}

      {suggestions.length > 0 && <p className={`review-state${reviewComplete ? ' is-ready' : ''}`}>{reviewComplete ? text.ready : text.needMore}</p>}
      <div className="review-actions">
        <button type="button" className="review-back" onClick={onBack}><span aria-hidden="true">←</span>{text.back}</button>
        <button type="button" className={`review-next${reviewComplete ? ' is-ready' : ''}`} title={reviewComplete ? text.next : text.needMore} onClick={onBuildDraft}>{reviewComplete ? text.next : (language === 'zh' ? '先审核已采用内容与原文' : 'Review adopted edits and original text')}<span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}
