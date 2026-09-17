'use client';

import {
  Document,
  Font,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReviewBlock, ResumeTemplate } from '../components/resume-document';
import { resumeEntry } from '../components/resume-document';
import { resumeLayout } from './resume-layout';

const CJK_FONT_FAMILY = 'ResumeProof Noto Sans SC';
const CJK_FONT_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
const CJK_FONT_BOLD_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf';
let cjkRegistered = false;
Font.registerHyphenationCallback((word) => [word]);

// Textkit treats non-space breaks as hyphenation. Tiny space runs supply natural
// CJK wrap opportunities without adding visible hyphens or widening glyph gaps.
function pdfText(value: string) {
  const parts = value.match(/[\u2e80-\u9fff\uf900-\ufaff][，。、；：！？）】》”’]*|[^\u2e80-\u9fff\uf900-\ufaff]+/gu) ?? [value];
  return parts.flatMap((part, index) => index ? [<Text key={index} style={{ fontSize: 0.01 }}> </Text>, part] : [part]);
}

function containsCjk(value: string) {
  return /[\u2e80-\u9fff\uf900-\ufaff]/u.test(value);
}

function ensureFonts(blocks: ReviewBlock[]) {
  if (cjkRegistered || !blocks.some((block) => containsCjk(block.text))) return;
  Font.register({
    family: CJK_FONT_FAMILY,
    fonts: [
      { src: CJK_FONT_URL, fontWeight: 400 },
      { src: CJK_FONT_BOLD_URL, fontWeight: 700 },
    ],
  });
  cjkRegistered = true;
}

function templateStyles(template: ResumeTemplate) {
  const m = resumeLayout(template);
  return StyleSheet.create({
    page: { paddingTop: m.top, paddingRight: m.side, paddingBottom: m.bottom, paddingLeft: m.side, color: m.ink, backgroundColor: '#fff', fontSize: m.body, lineHeight: m.leading },
    name: { fontSize: m.name, fontWeight: 700, marginBottom: 5, lineHeight: 1.15 },
    headline: { fontSize: m.headline, color: m.muted, marginBottom: 5, lineHeight: 1.4 },
    contact: { fontSize: m.contact, color: m.muted, marginBottom: 4, lineHeight: 1.5 },
    section: { fontSize: m.section, fontWeight: 700, color: m.accent, marginTop: m.sectionBefore, marginBottom: m.sectionAfter, lineHeight: 1.35 },
    entry: { marginTop: m.entryBefore, marginBottom: m.entryAfter },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
    entryTitle: { flexGrow: 1, flexShrink: 1, fontSize: m.entry, fontWeight: 700, lineHeight: 1.4 },
    entryDate: { maxWidth: 150, flexShrink: 0, fontSize: m.date, color: m.muted, textAlign: 'right', lineHeight: 1.4 },
    role: { fontSize: m.role, color: m.muted, marginTop: 3, lineHeight: 1.4 },
    body: { marginBottom: m.paragraphAfter },
    bullet: { flexDirection: 'row', marginBottom: m.bulletAfter },
    bulletMark: { width: 12, fontSize: 8, color: m.muted, lineHeight: m.body * m.leading / 8 },
    bulletText: { flexGrow: 1, flexShrink: 1 },
  });
}

function ResumePdfDocument({ blocks, template, language }: { blocks: ReviewBlock[]; template: ResumeTemplate; language: 'zh' | 'en' }) {
  const styles = templateStyles(template);
  const fontFamily = blocks.some((block) => containsCjk(block.text)) ? CJK_FONT_FAMILY : 'Helvetica';
  return (
    <Document
      title={language === 'zh' ? '求职简历' : 'Resume'}
      subject="Resume generated after factual review"
      creator="ResumeProof Match"
      producer="ResumeProof Match"
      language={language === 'zh' ? 'zh-CN' : 'en'}
    >
      <Page size="A4" style={{ ...styles.page, fontFamily }}>
        {blocks.map((block, index) => {
          const key = `${block.kind}-${index}`;
          const text = block.text.trim();
          if (!text) return null;
          if (block.kind === 'name') return <Text key={key} style={styles.name}>{pdfText(text)}</Text>;
          if (block.kind === 'headline') return <Text key={key} style={styles.headline}>{pdfText(text)}</Text>;
          if (block.kind === 'contact') return <Text key={key} style={styles.contact}>{pdfText(text)}</Text>;
          if (block.kind === 'section') return <Text key={key} style={styles.section} minPresenceAhead={42}>{pdfText(text.replace(/[:：]$/, ''))}</Text>;
          if (block.kind === 'entry') {
            const entry = resumeEntry(block);
            return <View key={key} wrap={false} style={[styles.entry, ...(blocks[index - 1]?.kind === 'section' ? [{ marginTop: 0 }] : [])]} minPresenceAhead={32}><View style={styles.entryRow}><Text style={styles.entryTitle}>{pdfText(entry.organization)}</Text>{entry.date && <Text style={styles.entryDate}>{pdfText(entry.date)}</Text>}</View>{entry.role && <Text style={styles.role}>{pdfText(entry.role)}</Text>}</View>;
          }
          if (block.kind === 'bullet') {
            const normalized = text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim();
            return <View key={key} style={styles.bullet} wrap={normalized.length > 700}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText} orphans={2} widows={2}>{pdfText(normalized)}</Text></View>;
          }
          return <Text key={key} style={styles.body} orphans={2} widows={2}>{pdfText(text)}</Text>;
        })}
      </Page>
    </Document>
  );
}

export async function createResumePdfBlob(blocks: ReviewBlock[], template: ResumeTemplate, language: 'zh' | 'en') {
  ensureFonts(blocks);
  return pdf(<ResumePdfDocument blocks={blocks} template={template} language={language} />).toBlob();
}
