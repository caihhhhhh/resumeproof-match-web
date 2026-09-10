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

const CJK_FONT_FAMILY = 'ResumeProof Noto Sans SC';
const CJK_FONT_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
const CJK_FONT_BOLD_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf';
let cjkRegistered = false;

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

const shared = {
  page: {
    size: 'A4' as const,
    paddingTop: 42.5,
    paddingRight: 48.2,
    paddingBottom: 39.7,
    paddingLeft: 48.2,
    backgroundColor: '#ffffff',
    color: '#18212b',
    fontSize: 10.4,
    lineHeight: 1.6,
  },
  name: { marginBottom: 3, color: '#18212b', fontSize: 23, fontWeight: 700 as const, lineHeight: 1.18, letterSpacing: 0.2 },
  headline: { marginBottom: 4, color: '#315f78', fontSize: 11.3, fontWeight: 700 as const, letterSpacing: 0.3 },
  contact: { marginTop: 2, marginBottom: 0, paddingBottom: 17, borderBottomWidth: 1.5, borderBottomColor: '#315f78', color: '#66717d', fontSize: 9.7 },
  section: { marginTop: 15.6, marginBottom: 9.1, color: '#315f78', fontSize: 12.2, fontWeight: 700 as const, lineHeight: 1.3, letterSpacing: 1.3 },
  entry: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 12, marginTop: 12.2, marginBottom: 3.7 },
  entryTitle: { flexGrow: 1, flexShrink: 1, color: '#18212b', fontSize: 10.8, fontWeight: 700 as const, lineHeight: 1.4 },
  entryDate: { flexShrink: 0, color: '#66717d', fontSize: 9.2, lineHeight: 1.4 },
  body: { marginBottom: 7.9 },
  bullet: { flexDirection: 'row' as const, gap: 4, marginBottom: 3.5 },
  bulletMark: { width: 10, color: '#315f78', fontSize: 7.7 },
  bulletText: { flexGrow: 1, flexShrink: 1 },
};

const compact = {
  ...shared,
  page: { ...shared.page, paddingTop: 36.9, paddingRight: 45.4, paddingBottom: 31.2, paddingLeft: 45.4, fontSize: 9.5, lineHeight: 1.46 },
  name: { ...shared.name, fontSize: 21 },
  headline: { ...shared.headline, fontSize: 10.5 },
  contact: { ...shared.contact, paddingBottom: 12, fontSize: 9 },
  section: { ...shared.section, marginTop: 11.4, marginBottom: 6.8, fontSize: 11.5 },
  entry: { ...shared.entry, marginTop: 8.5, marginBottom: 2.8 },
  entryTitle: { ...shared.entryTitle, fontSize: 10.1 },
  entryDate: { ...shared.entryDate, fontSize: 8.7 },
  body: { marginBottom: 4.5 },
  bullet: { ...shared.bullet, marginBottom: 2.3 },
};

const minimal = {
  ...shared,
  headline: { ...shared.headline, color: '#3e4954' },
  contact: { ...shared.contact, borderBottomColor: '#9aa4ae' },
  section: { ...shared.section, color: '#18212b', letterSpacing: 0.7 },
  bulletMark: { ...shared.bulletMark, color: '#66717d' },
};

function templateStyles(template: ResumeTemplate) {
  return StyleSheet.create(template === 'compact' ? compact : template === 'minimal' ? minimal : shared);
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
          if (block.kind === 'name') return <Text key={key} style={styles.name}>{text}</Text>;
          if (block.kind === 'headline') return <Text key={key} style={styles.headline}>{text}</Text>;
          if (block.kind === 'contact') return <Text key={key} style={styles.contact}>{text}</Text>;
          if (block.kind === 'section') return <Text key={key} style={styles.section} minPresenceAhead={42}>{text.replace(/[:：]$/, '')}</Text>;
          if (block.kind === 'entry') {
            const entry = resumeEntry(block);
            return <View key={key} style={styles.entry} minPresenceAhead={28}><Text style={styles.entryTitle}>{entry.title}</Text>{entry.date && <Text style={styles.entryDate}>{entry.date}</Text>}</View>;
          }
          if (block.kind === 'bullet') {
            const normalized = text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim();
            return <View key={key} style={styles.bullet} wrap><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>{normalized}</Text></View>;
          }
          return <Text key={key} style={styles.body}>{text}</Text>;
        })}
      </Page>
    </Document>
  );
}

export async function createResumePdfBlob(blocks: ReviewBlock[], template: ResumeTemplate, language: 'zh' | 'en') {
  ensureFonts(blocks);
  return pdf(<ResumePdfDocument blocks={blocks} template={template} language={language} />).toBlob();
}
