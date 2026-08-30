'use client';

import { ReviewBlock, splitResumeEntry } from './resume-document';

type Props = {
  blocks: ReviewBlock[];
  language: 'zh' | 'en';
  onChange: (blocks: ReviewBlock[]) => void;
  onRawChange: (value: string) => void;
  rawValue: string;
};

type Group = { headingIndex: number | null; title: string; indices: number[] };
type EntryCard = { entryIndex: number; contentIndices: number[] };

const labels = {
  zh: { header: '基本信息', addLine: '添加一行', addEntry: '添加一段经历', addOutcome: '添加成果', remove: '删除', duplicate: '复制', up: '上移', down: '下移', raw: '高级：编辑原始文本', rawHint: '适合批量粘贴或修复识别结果。修改后会重新识别分区。', empty: '这一部分还没有内容。', company: '公司 / 组织', role: '职位 / 角色', date: '时间', school: '学校', degree: '专业 / 学位', project: '项目名称', projectRole: '项目角色' },
  en: { header: 'Header', addLine: 'Add line', addEntry: 'Add experience', addOutcome: 'Add outcome', remove: 'Delete', duplicate: 'Duplicate', up: 'Move up', down: 'Move down', raw: 'Advanced: edit raw text', rawHint: 'Useful for bulk paste or fixing extracted text. Sections will be detected again.', empty: 'This section is empty.', company: 'Company / organization', role: 'Title / role', date: 'Dates', school: 'School', degree: 'Degree / major', project: 'Project name', projectRole: 'Project role' },
};

const ENTRY_SECTION = /(工作|实习|项目|教育|experience|intern|project|education)/i;
const EDUCATION_SECTION = /(教育|education)/i;
const PROJECT_SECTION = /(项目|project)/i;
const REVIEW_BULLET_PREFIX = /^(?:[•·▪◦]|[-*]\s)\s*/;

function groupBlocks(blocks: ReviewBlock[], headerTitle: string): Group[] {
  const groups: Group[] = [{ headingIndex: null, title: headerTitle, indices: [] }];
  for (const [index, block] of blocks.entries()) {
    if (block.kind === 'section') groups.push({ headingIndex: index, title: block.text.replace(/[:：]$/, ''), indices: [] });
    else groups.at(-1)?.indices.push(index);
  }
  return groups.filter((group, index) => index > 0 || group.indices.length > 0);
}

function entryCards(group: Group, blocks: ReviewBlock[]): EntryCard[] {
  const cards: EntryCard[] = [];
  for (const index of group.indices) {
    if (blocks[index].kind === 'entry') cards.push({ entryIndex: index, contentIndices: [] });
    else cards.at(-1)?.contentIndices.push(index);
  }
  return cards;
}

function fieldLabel(kind: ReviewBlock['kind'], language: 'zh' | 'en') {
  const zh = { name: '姓名', headline: '目标方向', contact: '联系方式', entry: '经历标题', bullet: '工作内容 / 成果', body: '内容', section: '模块名称' };
  const en = { name: 'Name', headline: 'Headline', contact: 'Contact', entry: 'Entry heading', bullet: 'Responsibility / outcome', body: 'Content', section: 'Section name' };
  return (language === 'zh' ? zh : en)[kind];
}

function parseEntryFields(value: string) {
  const { title, date } = splitResumeEntry(value);
  const parts = title.split(/\s*[|｜]\s*/);
  return { organization: parts.shift() ?? '', role: parts.join(' | '), date };
}

function buildEntryText(organization: string, role: string, date: string) {
  return [organization.trim(), role.trim()].filter(Boolean).join(' | ') + (date.trim() ? ` ${date.trim()}` : '');
}

export function ResumeStructuredEditor({ blocks, language, onChange, onRawChange, rawValue }: Props) {
  const t = labels[language];
  const groups = groupBlocks(blocks, t.header);

  function update(index: number, text: string) { onChange(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, text } : block)); }
  function remove(index: number) { onChange(blocks.filter((_, blockIndex) => blockIndex !== index)); }
  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length || blocks[target].kind === 'section' || blocks[target].kind === 'entry') return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function addLine(group: Group) {
    const insertAt = group.indices.length ? group.indices.at(-1)! + 1 : (group.headingIndex ?? -1) + 1;
    const next = [...blocks];
    next.splice(insertAt, 0, { kind: 'body', text: '' });
    onChange(next);
  }
  function addEntry(group: Group) {
    const insertAt = group.indices.length ? group.indices.at(-1)! + 1 : (group.headingIndex ?? -1) + 1;
    const next = [...blocks];
    next.splice(insertAt, 0, { kind: 'entry', text: '' }, { kind: 'bullet', text: '• ' });
    onChange(next);
  }
  function addOutcome(card: EntryCard) {
    const insertAt = card.contentIndices.length ? card.contentIndices.at(-1)! + 1 : card.entryIndex + 1;
    const next = [...blocks];
    next.splice(insertAt, 0, { kind: 'bullet', text: '• ' });
    onChange(next);
  }
  function cardRange(cards: EntryCard[], cardIndex: number) {
    const start = cards[cardIndex].entryIndex;
    const lastContent = cards[cardIndex].contentIndices.at(-1);
    const end = cardIndex + 1 < cards.length ? cards[cardIndex + 1].entryIndex : (lastContent === undefined ? start + 1 : lastContent + 1);
    return { start, end };
  }
  function removeEntry(cards: EntryCard[], cardIndex: number) {
    const { start, end } = cardRange(cards, cardIndex);
    onChange(blocks.filter((_, index) => index < start || index >= end));
  }
  function duplicateEntry(cards: EntryCard[], cardIndex: number) {
    const { start, end } = cardRange(cards, cardIndex);
    const next = [...blocks];
    next.splice(end, 0, ...blocks.slice(start, end).map((block) => ({ ...block })));
    onChange(next);
  }
  function moveEntry(cards: EntryCard[], cardIndex: number, direction: -1 | 1) {
    const targetIndex = cardIndex + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const firstIndex = Math.min(cardIndex, targetIndex);
    const secondIndex = Math.max(cardIndex, targetIndex);
    const first = cardRange(cards, firstIndex);
    const second = cardRange(cards, secondIndex);
    onChange([...blocks.slice(0, first.start), ...blocks.slice(second.start, second.end), ...blocks.slice(first.start, first.end), ...blocks.slice(second.end)]);
  }
  function updateEntry(index: number, field: 'organization' | 'role' | 'date', value: string) {
    const fields = parseEntryFields(blocks[index].text);
    fields[field] = value;
    update(index, buildEntryText(fields.organization, fields.role, fields.date));
  }

  return <div className="structured-editor">
    <div className="structured-editor-intro"><div><strong>{language === 'zh' ? '按模块编辑' : 'Edit by section'}</strong><p>{language === 'zh' ? '每个模块可以包含多段经历；每段经历再添加自己的职责和成果。' : 'Each section can contain multiple entries, each with its own responsibilities and outcomes.'}</p></div><span>{blocks.length}</span></div>
    {groups.map((group, groupIndex) => {
      const isEntryGroup = group.headingIndex !== null && ENTRY_SECTION.test(group.title);
      const cards = isEntryGroup ? entryCards(group, blocks) : [];
      return <details className="resume-editor-group" key={`${group.title}-${groupIndex}`} open={groupIndex < 3}>
        <summary><span>{group.title}</span><small>{isEntryGroup ? cards.length : group.indices.length}</small></summary>
        <div className="resume-editor-fields">
          {group.headingIndex !== null && <label className="resume-editor-section-name"><span>{fieldLabel('section', language)}</span><input value={blocks[group.headingIndex].text.replace(/[:：]$/, '')} onChange={(event) => update(group.headingIndex!, event.target.value)} /></label>}
          {isEntryGroup ? <>
            {cards.length ? cards.map((card, cardIndex) => {
              const fields = parseEntryFields(blocks[card.entryIndex].text);
              const organizationLabel = EDUCATION_SECTION.test(group.title) ? t.school : PROJECT_SECTION.test(group.title) ? t.project : t.company;
              const roleLabel = EDUCATION_SECTION.test(group.title) ? t.degree : PROJECT_SECTION.test(group.title) ? t.projectRole : t.role;
              return <article className="experience-editor-card" key={`${card.entryIndex}-${cardIndex}`}>
                <header><strong>{fields.organization || `${group.title} ${cardIndex + 1}`}</strong><div><button type="button" disabled={cardIndex === 0} onClick={() => moveEntry(cards, cardIndex, -1)} aria-label={t.up}>↑</button><button type="button" disabled={cardIndex === cards.length - 1} onClick={() => moveEntry(cards, cardIndex, 1)} aria-label={t.down}>↓</button><button type="button" onClick={() => duplicateEntry(cards, cardIndex)}>{t.duplicate}</button><button type="button" onClick={() => removeEntry(cards, cardIndex)}>{t.remove}</button></div></header>
                <div className="experience-editor-meta"><label><span>{organizationLabel}</span><input value={fields.organization} onChange={(event) => updateEntry(card.entryIndex, 'organization', event.target.value)} /></label><label><span>{roleLabel}</span><input value={fields.role} onChange={(event) => updateEntry(card.entryIndex, 'role', event.target.value)} /></label><label><span>{t.date}</span><input value={fields.date} onChange={(event) => updateEntry(card.entryIndex, 'date', event.target.value)} placeholder={language === 'zh' ? '2023.06 - 至今' : '2023.06 - Present'} /></label></div>
                <div className="experience-editor-outcomes">
                  {card.contentIndices.map((index, position) => <div className="resume-editor-field is-bullet" key={`${index}-${position}`}><label><span>{fieldLabel(blocks[index].kind, language)}</span><textarea rows={2} value={blocks[index].text.replace(REVIEW_BULLET_PREFIX, '')} onChange={(event) => update(index, `• ${event.target.value}`)} /></label><div className="resume-editor-field-actions"><button type="button" aria-label={t.up} disabled={position === 0} onClick={() => moveLine(index, -1)}>↑</button><button type="button" aria-label={t.down} disabled={position === card.contentIndices.length - 1} onClick={() => moveLine(index, 1)}>↓</button><button type="button" onClick={() => remove(index)}>{t.remove}</button></div></div>)}
                  <button type="button" className="resume-editor-add is-outcome" onClick={() => addOutcome(card)}>＋ {t.addOutcome}</button>
                </div>
              </article>;
            }) : <p className="resume-editor-empty">{t.empty}</p>}
            <button type="button" className="resume-editor-add is-entry" onClick={() => addEntry(group)}>＋ {t.addEntry}</button>
          </> : <>
            {group.indices.length ? group.indices.map((index, position) => {
              const block = blocks[index];
              const multiline = block.kind === 'bullet' || block.kind === 'body';
              return <div className={`resume-editor-field is-${block.kind}`} key={`${index}-${block.kind}`}><label><span>{fieldLabel(block.kind, language)}</span>{multiline ? <textarea rows={2} value={block.text.replace(REVIEW_BULLET_PREFIX, '')} onChange={(event) => update(index, block.kind === 'bullet' ? `• ${event.target.value}` : event.target.value)} /> : <input value={block.text} onChange={(event) => update(index, event.target.value)} />}</label><div className="resume-editor-field-actions"><button type="button" aria-label={t.up} disabled={position === 0} onClick={() => moveLine(index, -1)}>↑</button><button type="button" aria-label={t.down} disabled={position === group.indices.length - 1} onClick={() => moveLine(index, 1)}>↓</button><button type="button" onClick={() => remove(index)}>{t.remove}</button></div></div>;
            }) : <p className="resume-editor-empty">{t.empty}</p>}
            <button type="button" className="resume-editor-add" onClick={() => addLine(group)}>＋ {t.addLine}</button>
          </>}
        </div>
      </details>;
    })}
    <details className="raw-resume-editor"><summary>{t.raw}</summary><div><p>{t.rawHint}</p><textarea rows={18} value={rawValue} onChange={(event) => onRawChange(event.target.value)} /></div></details>
  </div>;
}
