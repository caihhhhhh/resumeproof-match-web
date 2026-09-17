// Points are shared by PDF, Word and browser typography.
export function resumeLayout(template: 'balanced' | 'compact' | 'minimal') {
  const compact = template === 'compact';
  return {
    body: compact ? 10 : 10.5, leading: compact ? 1.45 : 1.55,
    name: compact ? 24 : 26, headline: 11, contact: 9,
    section: 11.5, entry: 11, date: 9, role: 10,
    sectionBefore: compact ? 13 : 18, sectionAfter: 7,
    entryBefore: compact ? 8 : 12, entryAfter: 5,
    paragraphAfter: compact ? 4 : 6, bulletAfter: compact ? 3 : 4,
    top: compact ? 40 : 46, side: compact ? 46 : 50, bottom: 44,
    ink: '#20252b', muted: '#5d6570', accent: template === 'minimal' ? '#20252b' : '#31566c',
  };
}

export const resumeDocumentCss = (['balanced', 'compact', 'minimal'] as const).map((template) => {
  const m = resumeLayout(template);
  const s = `.resume-paper.resume-paper.template-${template}`;
  return `
${s} { box-sizing:border-box; width:210mm; max-width:100%; min-height:297mm; padding:${m.top}pt ${m.side}pt ${m.bottom}pt; margin:0 auto; background:white; color:${m.ink}; font-family:Arial,"Microsoft YaHei","PingFang SC",sans-serif; font-size:${m.body}pt; line-height:${m.leading}; text-align:left; }
${s} h1 { margin:0 0 5pt; font-size:${m.name}pt; line-height:1.15; font-weight:700; letter-spacing:0; color:${m.ink}; }
${s} h2 { margin:${m.sectionBefore}pt 0 ${m.sectionAfter}pt; font-size:${m.section}pt; line-height:1.35; font-weight:700; letter-spacing:0; color:${m.accent}; break-after:avoid; }
${s} p { margin:0 0 ${m.paragraphAfter}pt; font-size:${m.body}pt; line-height:${m.leading}; overflow-wrap:anywhere; orphans:2; widows:2; }
${s} h1 + .resume-headline { margin:0 0 5pt; font-size:${m.headline}pt; color:${m.muted}; font-weight:400; line-height:1.4; letter-spacing:0; }
${s} .resume-contact,${s} .resume-headline + .resume-contact { margin:0 0 4pt; padding:0; border:0; font-size:${m.contact}pt; color:${m.muted}; line-height:1.5; }
${s} .resume-entry { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,auto); align-items:baseline; gap:3pt 14pt; margin:${m.entryBefore}pt 0 ${m.entryAfter}pt; break-after:avoid; break-inside:avoid; }
${s} h2 + .resume-entry { margin-top:0; }
${s} .resume-entry h3 { margin:0; font-size:${m.entry}pt; font-weight:700; line-height:1.4; color:${m.ink}; letter-spacing:0; overflow-wrap:anywhere; }
${s} .resume-entry > span { font-size:${m.date}pt; line-height:1.4; color:${m.muted}; white-space:normal; text-align:right; max-width:150pt; }
${s} .resume-entry .resume-role { grid-column:1 / -1; margin:0; font-size:${m.role}pt; line-height:1.4; color:${m.muted}; }
${s} .resume-bullet { display:block; position:relative; padding-left:12pt; margin:0 0 ${m.bulletAfter}pt; font-size:${m.body}pt; line-height:${m.leading}; }
${s} .resume-bullet::before { content:'•'; position:absolute; left:1pt; top:0; color:${m.muted}; font-size:8pt; line-height:${m.body * m.leading}pt; }
`;
}).join('\n');
