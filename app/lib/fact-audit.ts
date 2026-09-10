import type { ReviewBlock } from '../components/resume-document';

export type FactChangeCategory = 'identity' | 'headline' | 'contact' | 'experience' | 'date' | 'number' | 'proper_noun' | 'claim';

export type FactChange = {
  id: string;
  category: FactChangeCategory;
  value: string;
};

function normalized(value: string) {
  return value.replace(/[|｜]/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

function additions(baseline: Iterable<string>, current: Iterable<string>) {
  const known = new Set([...baseline].map(normalized));
  return [...current].map((value) => value.trim()).filter((value) => value && !known.has(normalized(value)));
}

function matches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].map((match) => match[0]);
}

function structured(blocks: ReviewBlock[], kind: ReviewBlock['kind']) {
  return blocks.filter((block) => block.kind === kind).map((block) => block.text);
}

function technicalTerms(value: string) {
  const tokens = matches(value, /\b[A-Za-z][A-Za-z0-9.+#-]{1,30}\b/g).filter((token) => {
    const letters = token.replace(/[^A-Za-z]/g, '');
    return /\d/.test(token)
      || (letters.length >= 2 && letters === letters.toUpperCase())
      || /[a-z][A-Z]/.test(token);
  });
  const titlePhrases = matches(value, /\b[A-Z][a-z]{2,}(?:\s+[A-Z][A-Za-z]{1,})+\b/g);
  return [...tokens, ...titlePhrases];
}

export function auditFactChanges(baselineText: string, currentText: string, baselineBlocks: ReviewBlock[], currentBlocks: ReviewBlock[]) {
  const changes: FactChange[] = [];
  const add = (category: FactChangeCategory, values: string[]) => {
    for (const value of values) {
      const clean = value.trim().replace(/\s+/g, ' ').slice(0, 240);
      const id = `${category}:${normalized(clean)}`;
      if (!clean || changes.some((item) => item.id === id)) continue;
      changes.push({ id, category, value: clean });
    }
  };

  add('identity', additions(structured(baselineBlocks, 'name'), structured(currentBlocks, 'name')));
  add('headline', additions(structured(baselineBlocks, 'headline'), structured(currentBlocks, 'headline')));
  add('contact', additions(structured(baselineBlocks, 'contact'), structured(currentBlocks, 'contact')));
  add('experience', additions(structured(baselineBlocks, 'entry'), structured(currentBlocks, 'entry')));

  const datePattern = /\b(?:19|20)\d{2}(?:[./-](?:0?[1-9]|1[0-2]))?(?:\s*[-–—至]\s*(?:present|至今|(?:19|20)\d{2}(?:[./-](?:0?[1-9]|1[0-2]))?))?/giu;
  add('date', additions(matches(baselineText, datePattern), matches(currentText, datePattern)));

  const numberPattern = /(?:[$¥€£]\s*)?\d+(?:[.,]\d+)*(?:\s*(?:%|万|亿|k|m|x|倍|人|个|次|用户|客户|years?|months?))?/giu;
  const relevantNumbers = (value: string) => matches(value, numberPattern).filter((item) => !/^(?:19|20)\d{2}$/.test(item.trim()));
  add('number', additions(relevantNumbers(baselineText), relevantNumbers(currentText)));
  add('proper_noun', additions(technicalTerms(baselineText), technicalTerms(currentText)));

  // Compare the complete metric-bearing statement, not a document-wide number set.
  const statements = (value: string) => value.split(/[\r\n。！？;；]+/).map((part) => part.trim()).filter(Boolean);
  const previous = statements(baselineText);
  for (const statement of statements(currentText)) {
    if (previous.some((line) => normalized(line) === normalized(statement))) continue;
    if (/\d/.test(statement)) add('number', [statement]);
    else if (/主导|牵头|负责|达成|实现|提升|增长|减少|降低|保障|确保|lead|own|achiev|improv|increas|reduc|deliver/i.test(statement)) {
      add('claim', [statement]);
    }
  }

  // One confirmation per changed statement; avoid repeating its individual numbers.
  return changes.filter((change) => !changes.some((other) => other !== change
    && other.value.includes(change.value)
    && (other.value.length > change.value.length || (other.category === 'experience' && change.category !== 'experience'))));
}
