import type { ReviewBlock, ResumeTemplate } from '../components/resume-document';
import { resumeEntry } from '../components/resume-document';
import { resumeDocumentCss, resumeLayout } from './resume-layout';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function standaloneResumeHtml(blocks: ReviewBlock[], template: ResumeTemplate, language: 'zh' | 'en') {
  const m = resumeLayout(template);
  const body = blocks.map((block) => {
    const normalized = block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '') : block.text;
    if (!normalized.trim()) return '';
    const text = escape(normalized.trim());
    if (block.kind === 'name') return `<h1>${text}</h1>`;
    if (block.kind === 'section') return `<h2>${text.replace(/[:：]$/, '')}</h2>`;
    if (block.kind === 'entry') {
      const entry = resumeEntry(block);
      return `<div class="resume-entry"><h3>${escape(entry.organization)}</h3>${entry.date ? `<span>${escape(entry.date)}</span>` : ''}${entry.role ? `<p class="resume-role">${escape(entry.role)}</p>` : ''}</div>`;
    }
    return `<p class="resume-${block.kind}">${text}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="${language === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Resume</title><style>
  body{margin:0;background:#eef0f2} .resume-paper{box-shadow:0 3px 18px #20252b18}
  ${resumeDocumentCss}
  @page{size:A4;margin:${m.top}pt ${m.side}pt ${m.bottom}pt}
  @media print{body{background:white}.resume-paper.resume-paper.template-${template}{width:auto;max-width:none;min-height:0;padding:0;margin:0;box-shadow:none}}
  </style></head><body><main class="resume-paper template-${template}">${body}</main></body></html>`;
}

export async function resumeDocxBlob(blocks: ReviewBlock[], language: 'zh' | 'en', template: ResumeTemplate) {
  const { Document, HeadingLevel, Packer, Paragraph, TabStopType, TextRun } = await import('docx');
  const m = resumeLayout(template);
  const font = language === 'zh' || blocks.some(b => /[\u2e80-\u9fff]/u.test(b.text)) ? 'Microsoft YaHei' : 'Arial';
  const color = (value: string) => value.slice(1);
  const run = (text: string, size: number, bold = false, ink = m.ink) => new TextRun({ text, font, size: size * 2, bold, color: color(ink) });
  const children = blocks.flatMap((block, index) => {
    const text = (block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '') : block.text).trim();
    if (!text) return [];
    if (block.kind === 'name') return [new Paragraph({ heading: HeadingLevel.TITLE, keepNext: true, spacing: { after: 100, line: 276 }, children: [run(text, m.name, true)] })];
    if (block.kind === 'headline') return [new Paragraph({ keepNext: true, spacing: { after: 100 }, children: [run(text, m.headline, false, m.muted)] })];
    if (block.kind === 'contact') return [new Paragraph({ keepNext: true, spacing: { after: 80 }, children: [run(text, m.contact, false, m.muted)] })];
    if (block.kind === 'section') return [new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: m.sectionBefore * 20, after: m.sectionAfter * 20, line: 324 }, children: [run(text.replace(/[:：]$/, ''), m.section, true, m.accent)] })];
    if (block.kind === 'entry') {
      const entry = resumeEntry(block);
      // A separate date line for very long organization names prevents tab overlap in Word.
      const longTitle = entry.organization.replace(/[^\x00-\x7F]/g, 'xx').length > 62;
      return [
        new Paragraph({ keepNext: true, spacing: { before: blocks[index - 1]?.kind === 'section' ? 0 : m.entryBefore * 20, after: entry.role || longTitle ? 60 : m.entryAfter * 20, line: 336 },
          tabStops: [{ type: TabStopType.RIGHT, position: 11906 - Math.round(m.side * 40) }],
          children: [run(entry.organization, m.entry, true), ...(!longTitle && entry.date ? [run('\t' + entry.date, m.date, false, m.muted)] : [])] }),
        ...(longTitle && entry.date ? [new Paragraph({ keepNext: true, spacing: { after: 60 }, children: [run(entry.date, m.date, false, m.muted)] })] : []),
        ...(entry.role ? [new Paragraph({ keepNext: true, spacing: { after: m.entryAfter * 20, line: 336 }, children: [run(entry.role, m.role, false, m.muted)] })] : []),
      ];
    }
    return [new Paragraph({ widowControl: true,
      ...(block.kind === 'bullet' ? { bullet: { level: 0 }, indent: { left: 240, hanging: 240 } } : {}),
      spacing: { after: (block.kind === 'bullet' ? m.bulletAfter : m.paragraphAfter) * 20, line: Math.round(m.leading * 240) },
      children: [run(text, m.body)],
    })];
  });
  return Packer.toBlob(new Document({
    styles: { default: { document: { run: { font, size: m.body * 2, color: color(m.ink) }, paragraph: { spacing: { line: Math.round(m.leading * 240) } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: m.top * 20, right: m.side * 20, bottom: m.bottom * 20, left: m.side * 20 } } }, children }],
  }));
}
