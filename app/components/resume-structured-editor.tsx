'use client';

import { ReviewBlock, splitResumeEntry } from './resume-document';

type Props = {
  blocks: ReviewBlock[];
  language: 'zh' | 'en';
  onChange: (blocks: ReviewBlock[], mode?: 'merge' | 'checkpoint') => void;
  onRawChange: (value: string) => void;
  rawValue: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

type Group = { headingIndex: number | null; title: string; indices: number[] };
type EntryCard = { entryIndex: number; contentIndices: number[] };

const labels = {
  zh: { header: '基本信息', addLine: '添加一行', addEntry: '添加一段经历', addOutcome: '添加成果', addSection: '添加简历模块', addSectionHint: '选择常用模块，添加后可直接改名、排序和填写。', added: '已添加', saved: '当前标签页自动保存', undo: '撤销', redo: '重做', remove: '删除', removeSection: '删除模块', duplicate: '复制', up: '上移', down: '下移', raw: '高级：编辑原始文本', rawHint: '适合批量粘贴或修复识别结果。修改后会重新识别分区。', empty: '这一部分还没有内容。', company: '公司 / 组织', role: '职位 / 角色', date: '时间', school: '学校', degree: '专业 / 学位', project: '项目名称', projectRole: '项目角色' },
  en: { header: 'Header', addLine: 'Add line', addEntry: 'Add experience', addOutcome: 'Add outcome', addSection: 'Add resume section', addSectionHint: 'Choose a common section, then rename, reorder, and fill it in.', added: 'Added', saved: 'Autosaved in this tab', undo: 'Undo', redo: 'Redo', remove: 'Delete', removeSection: 'Delete section', duplicate: 'Duplicate', up: 'Move up', down: 'Move down', raw: 'Advanced: edit raw text', rawHint: 'Useful for bulk paste or fixing extracted text. Sections will be detected again.', empty: 'This section is empty.', company: 'Company / organization', role: 'Title / role', date: 'Dates', school: 'School', degree: 'Degree / major', project: 'Project name', projectRole: 'Project role' },
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
    if (blocks[index].kind === 'entry' || !cards.length) cards.push({ entryIndex: index, contentIndices: [] });
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

function withEntryField(block: ReviewBlock, field: 'organization' | 'role' | 'date', value: string): ReviewBlock {
  const fields = { ...(block.fields ?? parseEntryFields(block.text)), [field]: value };
  return { ...block, kind: 'entry', fields, text: buildEntryText(fields.organization, fields.role, fields.date) };
}

export function ResumeStructuredEditor({ blocks, language, onChange, onRawChange, rawValue, canUndo, canRedo, onUndo, onRedo }: Props) {
  const t = labels[language];
  const groups = groupBlocks(blocks, t.header);
  const sectionGroups = groups.filter((group) => group.headingIndex !== null);
  const sectionPresets = language === 'zh'
    ? ['工作经历', '项目经历', '实习经历', '教育经历', '专业技能', '证书', '语言能力', '自定义模块']
    : ['Work Experience', 'Projects', 'Internships', 'Education', 'Skills', 'Certifications', 'Languages', 'Custom Section'];

  function update(index: number, text: string) { onChange(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, text } : block), 'merge'); }
  function remove(index: number) { onChange(blocks.filter((_, blockIndex) => blockIndex !== index), 'checkpoint'); }
  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length || blocks[target].kind === 'section' || blocks[target].kind === 'entry') return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, 'checkpoint');
  }
  function addLine(group: Group) {
    const insertAt = group.indices.length ? group.indices.at(-1)! + 1 : (group.headingIndex ?? -1) + 1;
    const next = [...blocks];
    next.splice(insertAt, 0, { kind: 'body', text: '' });
    onChange(next, 'checkpoint');
  }
  function addEntry(group: Group) {
    const insertAt = group.indices.length ? group.indices.at(-1)! + 1 : (group.headingIndex ?? -1) + 1;
    const next = [...blocks];
    const entryBlocks: ReviewBlock[] = [{ kind: 'entry', text: '' }];
    if (!EDUCATION_SECTION.test(group.title)) entryBlocks.push({ kind: 'bullet', text: '• ' });
    next.splice(insertAt, 0, ...entryBlocks);
    onChange(next, 'checkpoint');
  }
  function addOutcome(card: EntryCard) {
    const insertAt = card.contentIndices.length ? card.contentIndices.at(-1)! + 1 : card.entryIndex + 1;
    const next = [...blocks];
    next.splice(insertAt, 0, { kind: 'bullet', text: '• ' });
    onChange(next, 'checkpoint');
  }
  function cardRange(cards: EntryCard[], cardIndex: number) {
    const start = cards[cardIndex].entryIndex;
    const lastContent = cards[cardIndex].contentIndices.at(-1);
    const end = cardIndex + 1 < cards.length ? cards[cardIndex + 1].entryIndex : (lastContent === undefined ? start + 1 : lastContent + 1);
    return { start, end };
  }
  function removeEntry(cards: EntryCard[], cardIndex: number) {
    const { start, end } = cardRange(cards, cardIndex);
    onChange(blocks.filter((_, index) => index < start || index >= end), 'checkpoint');
  }
  function duplicateEntry(cards: EntryCard[], cardIndex: number) {
    const { start, end } = cardRange(cards, cardIndex);
    const next = [...blocks];
    next.splice(end, 0, ...blocks.slice(start, end).map((block) => ({ ...block })));
    onChange(next, 'checkpoint');
  }
  function moveEntry(cards: EntryCard[], cardIndex: number, direction: -1 | 1) {
    const targetIndex = cardIndex + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const firstIndex = Math.min(cardIndex, targetIndex);
    const secondIndex = Math.max(cardIndex, targetIndex);
    const first = cardRange(cards, firstIndex);
    const second = cardRange(cards, secondIndex);
    onChange([...blocks.slice(0, first.start), ...blocks.slice(second.start, second.end), ...blocks.slice(first.start, first.end), ...blocks.slice(second.end)], 'checkpoint');
  }
  function updateEntry(index: number, field: 'organization' | 'role' | 'date', value: string) {
    onChange(blocks.map((block, blockIndex) => blockIndex === index ? withEntryField(block, field, value) : block), 'merge');
  }
  function sectionRange(group: Group) {
    const start = group.headingIndex!;
    const lastContent = group.indices.at(-1);
    return { start, end: lastContent === undefined ? start + 1 : lastContent + 1 };
  }
  function moveSection(group: Group, direction: -1 | 1) {
    const position = sectionGroups.findIndex((item) => item.headingIndex === group.headingIndex);
    const targetPosition = position + direction;
    if (position < 0 || targetPosition < 0 || targetPosition >= sectionGroups.length) return;
    const firstPosition = Math.min(position, targetPosition);
    const secondPosition = Math.max(position, targetPosition);
    const first = sectionRange(sectionGroups[firstPosition]);
    const second = sectionRange(sectionGroups[secondPosition]);
    onChange([...blocks.slice(0, first.start), ...blocks.slice(second.start, second.end), ...blocks.slice(first.start, first.end), ...blocks.slice(second.end)], 'checkpoint');
  }
  function deleteSection(group: Group) {
    const message = language === 'zh' ? `删除“${group.title}”及其中全部内容？` : `Delete “${group.title}” and all of its content?`;
    if (!window.confirm(message)) return;
    const { start, end } = sectionRange(group);
    onChange(blocks.filter((_, index) => index < start || index >= end), 'checkpoint');
  }
  function addSection(title: string) {
    const isEntrySection = ENTRY_SECTION.test(title);
    const next: ReviewBlock[] = [{ kind: 'section', text: title }];
    if (isEntrySection) {
      next.push({ kind: 'entry', text: '' });
      if (!EDUCATION_SECTION.test(title)) next.push({ kind: 'bullet', text: '• ' });
    }
    else next.push({ kind: 'body', text: '' });
    onChange([...blocks, ...next], 'checkpoint');
  }

  return <div className="structured-editor">
    <div className="structured-editor-intro"><div><strong>{language === 'zh' ? '按模块编辑' : 'Edit by section'}</strong><p>{language === 'zh' ? '每个模块可以包含多段经历；每段经历再添加自己的职责和成果。' : 'Each section can contain multiple entries, each with its own responsibilities and outcomes.'}</p><small>{t.saved}</small></div><div className="review-history-controls"><button type="button" disabled={!canUndo} onClick={onUndo}>← {t.undo}</button><button type="button" disabled={!canRedo} onClick={onRedo}>{t.redo} →</button></div></div>
    {groups.map((group, groupIndex) => {
      const isEntryGroup = group.headingIndex !== null && (ENTRY_SECTION.test(group.title) || group.indices.some((index) => blocks[index].kind === 'entry'));
      const cards = isEntryGroup ? entryCards(group, blocks) : [];
      return <details className="resume-editor-group" key={groupIndex} open={groupIndex < 3}>
        <summary><span>{group.title}</span><small>{isEntryGroup ? cards.length : group.indices.length}</small></summary>
        <div className="resume-editor-fields">
          {group.headingIndex !== null && <><label className="resume-editor-section-name"><span>{fieldLabel('section', language)}</span><input value={blocks[group.headingIndex].text.replace(/[:：]$/, '')} onChange={(event) => update(group.headingIndex!, event.target.value)} /></label><div className="resume-editor-section-actions"><button type="button" disabled={sectionGroups[0]?.headingIndex === group.headingIndex} onClick={() => moveSection(group, -1)}>↑ {t.up}</button><button type="button" disabled={sectionGroups.at(-1)?.headingIndex === group.headingIndex} onClick={() => moveSection(group, 1)}>↓ {t.down}</button><button type="button" className="is-danger" onClick={() => deleteSection(group)}>{t.removeSection}</button></div></>}
          {isEntryGroup ? <>
            {cards.length ? cards.map((card, cardIndex) => {
              const fields = blocks[card.entryIndex].fields ?? parseEntryFields(blocks[card.entryIndex].text);
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
    <details className="resume-section-library"><summary>＋ {t.addSection}</summary><div><p>{t.addSectionHint}</p><div>{sectionPresets.map((title) => { const exists = title !== (language === 'zh' ? '自定义模块' : 'Custom Section') && sectionGroups.some((group) => group.title.toLowerCase() === title.toLowerCase()); return <button type="button" key={title} disabled={exists} onClick={() => addSection(title)}><span>{title}</span>{exists && <small>{t.added}</small>}</button>; })}</div></div></details>
    <details className="raw-resume-editor"><summary>{t.raw}</summary><div><p>{t.rawHint}</p><textarea rows={18} value={rawValue} onChange={(event) => onRawChange(event.target.value)} /></div></details>
  </div>;
}
