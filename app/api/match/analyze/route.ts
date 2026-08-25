import type { EvidenceItem, MatchAnalysis, OptimizationSuggestion, RequirementImportance, ScoreBreakdown } from '../../../lib/match-analysis';
import { guardApiRequest, privateJson } from '../../../lib/request-guard';

export const runtime = 'nodejs';

const CORE_EXAMPLE = {
  summary: 'one concise conclusion',
  strengths: ['strength'], gaps: ['gap'],
  evidence: [{ requirement: 'JD requirement', importance: 'must', sourceIds: [1], rationale: 'short semantic explanation', status: 'strong' }],
};

const SUGGESTION_EXAMPLE = {
  suggestions: [{ id: 'rewrite-1', kind: 'rewrite', targetSection: 'section name', sourceId: 1, revisedText: 'fact-preserving revision', rationale: 'specific source weakness and revision logic', expectedImpact: 'specific recruiter or ATS signal improved', relatedRequirement: 'JD requirement', requiresFact: false }],
};

type RawCore = {
  summary: string;
  strengths: string[];
  gaps: string[];
  evidence: RawEvidence[];
};

type RawEvidence = Omit<EvidenceItem, 'resumeEvidence'> & { sourceIds: number[] };
type RawSuggestion = Omit<OptimizationSuggestion, 'originalText' | 'sourceStart' | 'sourceEnd'> & { sourceId: number };
type ResumeSource = { text: string; start: number; end: number };

type DeepSeekConfig = { apiKey: string; baseUrl: string; model: string };

class DeepSeekRequestError extends Error {
  constructor(public status: number) { super(`DEEPSEEK_HTTP_${status}`); }
}

class DeepSeekTimeoutError extends Error {}

function deepSeekFailureResponse(error: unknown) {
  if (error instanceof DeepSeekTimeoutError) return privateJson({ error: 'DEEPSEEK_TIMEOUT' }, { status: 504 });
  if (error instanceof DeepSeekRequestError) {
    if (error.status === 401 || error.status === 403) return privateJson({ error: 'DEEPSEEK_AUTH_FAILED' }, { status: 502 });
    if (error.status === 402) return privateJson({ error: 'DEEPSEEK_BALANCE' }, { status: 503 });
    if (error.status === 429) return privateJson({ error: 'DEEPSEEK_RATE_LIMIT' }, { status: 429 });
    return privateJson({ error: 'DEEPSEEK_UPSTREAM' }, { status: 502 });
  }
  if (error instanceof SyntaxError || (error instanceof Error && /(?:JSON|OUTPUT|CORE|SUGGESTIONS)/.test(error.message))) {
    return privateJson({ error: 'DEEPSEEK_INVALID_OUTPUT' }, { status: 502 });
  }
  return privateJson({ error: 'DEEPSEEK_UPSTREAM' }, { status: 502 });
}

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
}

function quoteExists(source: string, quote: string) {
  const normalizedQuote = normalize(quote);
  return normalizedQuote.length >= 6 && normalize(source).includes(normalizedQuote);
}

function metricSignals(resume: string) {
  return resume.match(/(?:\d+(?:\.\d+)?\s*%|[$¥€£]\s*\d|\d+(?:\.\d+)?\s*(?:万|亿|倍|人|个|次|用户|客户|days?|months?))/giu)?.length ?? 0;
}

function hasUnsupportedNumber(original: string, revised: string) {
  const originalNumbers = new Set(original.match(/\d+(?:\.\d+)?%?/g) ?? []);
  return (revised.match(/\d+(?:\.\d+)?%?/g) ?? []).some((value) => !originalNumbers.has(value));
}

function hasUnsupportedClaim(original: string, revised: string) {
  const claimTerms = ['深度分析', '受众分层', '闭环', '全链路', '主导', '牵头', '确保', '保障', 'leadership', 'spearheaded', 'end-to-end ownership'];
  const source = normalize(original);
  const proposal = normalize(revised);
  return claimTerms.some((term) => proposal.includes(term.toLowerCase()) && !source.includes(term.toLowerCase()));
}

function parseJsonObject(content: string | null) {
  if (!content?.trim()) throw new Error('EMPTY_OUTPUT');
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('MISSING_JSON');
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function parseCore(content: string | null): RawCore {
  const value = parseJsonObject(content);
  if (!value || typeof value !== 'object') throw new Error('INVALID_CORE');
  const raw = value as Partial<RawCore>;
  const validEvidence = Array.isArray(raw.evidence) && raw.evidence.length > 0 && raw.evidence.every((item) => item && typeof item.requirement === 'string'
    && ['must', 'important', 'bonus'].includes(item.importance) && Array.isArray(item.sourceIds) && item.sourceIds.every(Number.isInteger)
    && typeof item.rationale === 'string' && ['strong', 'partial', 'gap'].includes(item.status));
  if (typeof raw.summary !== 'string' || !Array.isArray(raw.strengths) || !Array.isArray(raw.gaps) || !validEvidence) throw new Error('INVALID_CORE');
  return raw as RawCore;
}

function parseSuggestions(content: string | null): RawSuggestion[] {
  const value = parseJsonObject(content);
  if (!value || typeof value !== 'object') throw new Error('INVALID_SUGGESTIONS');
  const suggestions = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || !suggestions.every((item) => item && typeof item.id === 'string'
    && ['rewrite', 'reorder', 'fact_check'].includes(item.kind) && typeof item.targetSection === 'string'
    && Number.isInteger(item.sourceId) && typeof item.revisedText === 'string'
    && typeof item.rationale === 'string' && typeof item.expectedImpact === 'string'
    && typeof item.relatedRequirement === 'string' && typeof item.requiresFact === 'boolean')) throw new Error('INVALID_SUGGESTIONS');
  return suggestions as RawSuggestion[];
}

function resumeSources(resume: string): ResumeSource[] {
  const sources: ResumeSource[] = [];
  const lines = [...resume.matchAll(/[^\r\n]+/g)].map((match) => {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = (match.index ?? 0) + leading;
    return { text: raw.trim(), start, end: (match.index ?? 0) + raw.length - trailing };
  });
  const startsBullet = (value: string) => /^[•▪◦●○*]\s*/.test(value);
  const startsStructure = (value: string) => /^(?:工作经历|实习经历|项目经历|教育经历|技能|专业技能|个人总结|个人简介|WORK EXPERIENCE|INTERNSHIPS?|PROJECTS?|EDUCATION|SKILLS?|SUMMARY)$/i.test(value)
    || (/^(?:19|20)\d{2}(?:[./-]\d{1,2})?\s*(?:[-–—至]\s*(?:present|至今|(?:19|20)\d{2})|$)/i.test(value) && value.length < 80)
    || (/\s[|｜]\s/.test(value) && value.length < 180);
  const finishesSentence = (value: string) => /[。！？.!?][”’"']?$/.test(value.trim());

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.text) continue;
    let end = line.end;
    if (!startsStructure(line.text)) {
      let cursor = index + 1;
      let latestText = line.text;
      while (cursor < lines.length && !finishesSentence(latestText) && !startsBullet(lines[cursor].text) && !startsStructure(lines[cursor].text)) {
        end = lines[cursor].end;
        latestText = lines[cursor].text;
        cursor += 1;
      }
      index = cursor - 1;
    }
    const text = resume.slice(line.start, end).trim();
    if (text.length < 18) continue;
    if (text.length <= 1_500) {
      sources.push({ text, start: line.start, end });
      continue;
    }
    for (const part of text.matchAll(/[^。！？.!?；;]{18,900}[。！？.!?；;]?/g)) {
      const partText = part[0].trim();
      const partLeading = part[0].length - part[0].trimStart().length;
      const partStart = line.start + (part.index ?? 0) + partLeading;
      sources.push({ text: partText, start: partStart, end: partStart + partText.length });
    }
  }
  return sources.slice(0, 160);
}

function looksLikeProtectedFactLine(value: string) {
  const hasDate = /(?:19|20)\d{2}[./-](?:0?[1-9]|1[0-2])|(?:19|20)\d{2}\s*[-–—]\s*(?:present|至今|(?:19|20)\d{2})/i.test(value);
  const looksLikeContact = /(?:@|linkedin\.com|github\.com|\+?\d[\d\s-]{7,})/i.test(value);
  const looksLikeEducation = /(?:大学|学院|university|college|bachelor|master|本科|硕士|博士)/i.test(value);
  return looksLikeContact || looksLikeEducation || (hasDate && value.length <= 180);
}

function sanitizeSuggestion(resume: string, sources: ResumeSource[], suggestion: RawSuggestion): OptimizationSuggestion | null {
  const source = sources[suggestion.sourceId - 1];
  const originalText = source?.text;
  if (!source || !originalText || !quoteExists(resume, originalText) || looksLikeProtectedFactLine(originalText)) return null;
  const bulletPrefix = originalText.match(/^([•▪◦●○\-–—*]\s*)/)?.[1] ?? '';
  let revisedText = suggestion.revisedText.trim();
  if (bulletPrefix && !/^[•▪◦●○\-–—*]\s*/.test(revisedText)) revisedText = `${bulletPrefix}${revisedText}`;
  if (!revisedText || normalize(revisedText) === normalize(originalText)) return null;
  return {
    ...suggestion,
    originalText,
    sourceStart: source.start,
    sourceEnd: source.end,
    id: suggestion.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || `suggestion-${crypto.randomUUID()}`,
    revisedText,
    requiresFact: suggestion.requiresFact || hasUnsupportedNumber(originalText, revisedText) || hasUnsupportedClaim(originalText, revisedText),
  };
}

function evidenceFraction(item: EvidenceItem) {
  return item.status === 'strong' ? 1 : item.status === 'partial' ? 0.5 : 0;
}

function importanceWeight(importance: RequirementImportance) {
  return importance === 'must' ? 3 : importance === 'important' ? 2 : 1;
}

function coverageFor(evidence: EvidenceItem[], importance: RequirementImportance) {
  const items = evidence.filter((item) => item.importance === importance);
  return items.length ? Math.round(items.reduce((total, item) => total + evidenceFraction(item), 0) / items.length * 100) : null;
}

function scoreEvidence(evidence: EvidenceItem[]) {
  const possible = evidence.reduce((total, item) => total + importanceWeight(item.importance), 0);
  const earned = evidence.reduce((total, item) => total + importanceWeight(item.importance) * evidenceFraction(item), 0);
  const scoring: ScoreBreakdown = {
    mustCoverage: coverageFor(evidence, 'must'), importantCoverage: coverageFor(evidence, 'important'), bonusCoverage: coverageFor(evidence, 'bonus'),
    verifiedEvidence: Math.round(evidence.filter((item) => item.resumeEvidence.length > 0).length / evidence.length * 100),
    totalRequirements: evidence.length,
    strongCount: evidence.filter((item) => item.status === 'strong').length,
    partialCount: evidence.filter((item) => item.status === 'partial').length,
    gapCount: evidence.filter((item) => item.status === 'gap').length,
  };
  return { overall: possible ? Math.round(earned / possible * 100) : 0, scoring };
}

function verifiedEvidence(sources: ResumeSource[], raw: RawCore, language: 'zh' | 'en') {
  return raw.evidence.map((item) => {
    const quotes = item.status === 'gap' ? [] : item.sourceIds.map((sourceId) => sources[sourceId - 1]?.text).filter((quote): quote is string => Boolean(quote)).slice(0, 3);
    return {
      requirement: item.requirement, importance: item.importance,
      resumeEvidence: quotes,
      status: quotes.length ? item.status : 'gap' as const,
      rationale: quotes.length ? item.rationale : (language === 'zh' ? '未找到可核对的简历原句。' : 'No verifiable resume excerpt was found.'),
    };
  }).slice(0, 8);
}

function coreIsComplete(raw: RawCore | null, evidence: EvidenceItem[]) {
  if (!raw || !raw.summary.trim()) return false;
  return raw.strengths.some((item) => item.trim())
    && raw.gaps.some((item) => item.trim())
    && evidence.length >= 3
    && evidence.some((item) => item.resumeEvidence.length > 0);
}

async function deepSeekCompletion(config: DeepSeekConfig, instructions: string, input: string, maxTokens: number) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }],
        max_tokens: maxTokens,
        temperature: 0,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new DeepSeekTimeoutError();
    throw error;
  }
  if (!response.ok) throw new DeepSeekRequestError(response.status);
  const result = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  return result.choices?.[0]?.message?.content ?? null;
}

async function requestCore(config: DeepSeekConfig, resume: string, jd: string, language: 'zh' | 'en', repair = false) {
  const numberedSources = resumeSources(resume).map((source, index) => `[${index + 1}] ${source.text}`).join('\n');
  const instructions = `You are an evidence-first resume analyst. Analyze semantic equivalence and transferable experience, not identical keywords. Use ${language === 'zh' ? 'Chinese' : 'English'} for prose. Select 6-8 decision-relevant JD requirements and label importance as must, important, or bonus. Classify each as strong, partial, or gap. For strong or partial matches, cite 1-3 valid sourceIds from the numbered resume lines; for a true gap, use an empty sourceIds array. Do not copy source text into another field. Do not infer absent tools, seniority, ownership, metrics, dates, or achievements. Applying ads on a channel is not partner relationship management. Coordinating content is not the same as creating it, and "multilingual" does not prove a specific language. When evidence supports only part of a requirement, use partial rather than strong. Return 2-6 concrete strengths and 2-6 concrete gaps. Keep every rationale concise.${repair ? ' A previous response was missing or invalid. This is a repair request: ensure every required field is populated and the JSON is complete.' : ''} Return one JSON object only with exactly these keys and value types: ${JSON.stringify(CORE_EXAMPLE)}`;
  return parseCore(await deepSeekCompletion(config, instructions, `NUMBERED RESUME SOURCES\n---\n${numberedSources}\n---\nJOB DESCRIPTION\n---\n${jd}`, 2_200));
}

async function requestSuggestions(config: DeepSeekConfig, resume: string, jd: string, language: 'zh' | 'en', repair = false) {
  const sources = resumeSources(resume);
  const numberedSources = sources.map((source, index) => `[${index + 1}] ${source.text}`).join('\n');
  const instructions = `You are an evidence-first resume editor. ${language === 'zh' ? 'Write rationale, expectedImpact, targetSection, and relatedRequirement in natural Chinese while preserving necessary English technical terms.' : 'Write all prose fields in natural English.'} Return 0-4 material rewrites. An empty suggestions array is correct when no source-backed improvement is worthwhile. Select sourceId only from the numbered resume paragraphs. Never select or rewrite personal information, company or organization names, job titles, dates, education, awards, or certificates. Only rewrite a complete work bullet, project outcome, or summary paragraph. Every factual concept, number, tool, platform, and proper noun in revisedText must already exist in that selected source paragraph. Do not pull facts from another paragraph. Do not add claims such as deep analysis, audience segmentation, closed-loop process, leadership, end-to-end ownership, or guaranteed impact unless explicitly present in that source. rationale must name the specific weakness and revision logic. expectedImpact must explain the concrete recruiter or ATS signal improved without promising an outcome. Never return an unchanged or cosmetically identical rewrite. If a useful change needs a missing fact, set requiresFact=true.${repair ? ' A previous response was invalid. Return complete valid JSON; zero suggestions remains acceptable.' : ''} Return one JSON object only with exactly these keys and value types: ${JSON.stringify(SUGGESTION_EXAMPLE)}`;
  return parseSuggestions(await deepSeekCompletion(config, instructions, `NUMBERED RESUME SOURCES\n---\n${numberedSources}\n---\nJOB DESCRIPTION\n---\n${jd}`, 1_900));
}

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, { bucket: 'match-analysis', limit: 8, maxBytes: 256 * 1024 });
  if (blocked) return blocked;
  let body: { resumeText?: unknown; jdText?: unknown; language?: unknown };
  try { body = await request.json(); } catch { return privateJson({ error: 'INVALID_JSON' }, { status: 400 }); }
  const resumeText = typeof body.resumeText === 'string' ? body.resumeText.trim() : '';
  const jdText = typeof body.jdText === 'string' ? body.jdText.trim() : '';
  const language = body.language === 'en' ? 'en' : 'zh';
  if (resumeText.length < 80 || jdText.length < 80) return privateJson({ error: 'MATERIALS_TOO_SHORT' }, { status: 400 });
  if (resumeText.length > 40_000 || jdText.length > 30_000) return privateJson({ error: 'MATERIALS_TOO_LONG' }, { status: 413 });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return privateJson({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });

  const config: DeepSeekConfig = { apiKey, baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com', model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash' };
  const sources = resumeSources(resumeText);
  const [coreResult, suggestionResult] = await Promise.allSettled([
    requestCore(config, resumeText, jdText, language),
    requestSuggestions(config, resumeText, jdText, language),
  ]);
  const initialFailure = coreResult.status === 'rejected' ? coreResult.reason
    : suggestionResult.status === 'rejected' ? suggestionResult.reason : null;
  if (coreResult.status === 'rejected' && suggestionResult.status === 'rejected'
    && (initialFailure instanceof DeepSeekRequestError || initialFailure instanceof DeepSeekTimeoutError)) {
    return deepSeekFailureResponse(initialFailure);
  }

  let suggestions = suggestionResult.status === 'fulfilled'
    ? suggestionResult.value.map((item) => sanitizeSuggestion(resumeText, sources, item)).filter((item): item is OptimizationSuggestion => Boolean(item)).slice(0, 4)
    : [];
  let raw = coreResult.status === 'fulfilled' ? coreResult.value : null;
  let evidence = raw ? verifiedEvidence(sources, raw, language) : [];

  const repairTasks: Array<Promise<{ kind: 'core'; value: RawCore } | { kind: 'suggestions'; value: RawSuggestion[] }>> = [];
  if (!coreIsComplete(raw, evidence)) {
    repairTasks.push(requestCore(config, resumeText, jdText, language, true).then((value) => ({ kind: 'core' as const, value })));
  }
  if (repairTasks.length) {
    const repaired = await Promise.allSettled(repairTasks);
    for (const result of repaired) {
      if (result.status !== 'fulfilled') continue;
      if (result.value.kind === 'core') {
        raw = result.value.value;
        evidence = verifiedEvidence(sources, raw, language);
      } else {
        suggestions = result.value.value.map((item) => sanitizeSuggestion(resumeText, sources, item))
          .filter((item): item is OptimizationSuggestion => Boolean(item)).slice(0, 4);
      }
    }
  }

  if (!coreIsComplete(raw, evidence) || !raw) {
    console.error('DeepSeek returned an incomplete report after targeted repair', {
      core: Boolean(raw), evidence: evidence.length, strengths: raw?.strengths.length ?? 0,
      gaps: raw?.gaps.length ?? 0, suggestions: suggestions.length,
    });
    if (initialFailure) return deepSeekFailureResponse(initialFailure);
    return privateJson({
      error: 'DEEPSEEK_INCOMPLETE_REPORT',
      details: {
        core: Boolean(raw), evidence: evidence.length, verifiedEvidence: evidence.filter((item) => item.resumeEvidence.length).length,
        strengths: raw?.strengths.length ?? 0, gaps: raw?.gaps.length ?? 0, suggestions: suggestions.length,
      },
    }, { status: 502 });
  }

  const { overall, scoring } = scoreEvidence(evidence);
  const hasMustGap = evidence.some((item) => item.importance === 'must' && item.status === 'gap');
  const grade = overall >= 80 && !hasMustGap && (scoring.mustCoverage ?? 0) >= 80 ? 'A' : overall >= 55 ? 'B' : 'C';
  const analysis: MatchAnalysis = {
    mode: 'ai',
    summary: raw.summary, overall, grade, scoring,
    coveredTerms: raw.strengths.slice(0, 6), missingTerms: raw.gaps.slice(0, 6), evidence,
    metricSignals: metricSignals(resumeText), suggestions,
  };
  return privateJson({ analysis });
}
