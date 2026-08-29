import { readRuntimeEvents, type RuntimeEventRow, type RuntimeRequestType } from './runtime-telemetry';
import { readContentSamples } from './content-samples';
import { readProductEvents, type ProductEventRow } from './product-events';
import { readFeedbackEvents, type FeedbackEventRow } from './feedback-events';

export type AdminRangeKey = '24h' | '7d' | '30d';

export type ProductAnalyticsSnapshot = {
  kpis: Array<{ label: string; value: string; note: string }>;
  steps: Array<{ key: string; label: string; count: number }>;
  quality: {
    analysisSuccessRate: number | null;
    suggestionAcceptanceRate: number | null;
    analysisFailures: number;
  };
};

export type FeedbackSnapshot = {
  total: number;
  helpful: number;
  helpfulRate: number | null;
  reasons: Array<{ key: string; label: string; count: number }>;
};

export type AdminRuntimeSnapshot = {
  label: string;
  kpis: Array<{ label: string; value: string; delta: string; tone: string }>;
  pipeline: Array<{ label: string; successRate: number | null; total: number }>;
  incidents: Array<{ time: number; title: string; copy: string; state: string }>;
  requests: Array<{ id: number; time: number; type: string; model: string; duration: string; status: string }>;
  summary: { lossPoint: string; fallbackCount: number; failureCount: number };
};

export type AdminRuntimeData = {
  ranges: Record<AdminRangeKey, AdminRuntimeSnapshot>;
  productRanges: Record<AdminRangeKey, ProductAnalyticsSnapshot>;
  feedbackRanges: Record<AdminRangeKey, FeedbackSnapshot>;
  hasData: boolean;
  samples: Array<{
    reference: string;
    time: number;
    expiresAt: number;
    language: 'zh' | 'en';
    resumeText: string;
    jdText: string;
    score: number;
    grade: 'A' | 'B' | 'C';
    summary: string;
  }>;
  providers: {
    deepseek: { configured: boolean; model: string; lastSuccess: number | null };
    zhipu: { configured: boolean; model: string; lastSuccess: number | null };
    ga4: { configured: boolean; measurementId: string };
  };
};

const requestLabels: Record<RuntimeRequestType, string> = {
  match: 'JD 匹配',
  ocr: '扫描件 OCR',
  jd_parse: 'JD 链接解析',
};

const errorLabels: Record<string, string> = {
  DEEPSEEK_TIMEOUT: 'AI 分析超时',
  DEEPSEEK_AUTH_FAILED: 'DeepSeek 密钥验证失败',
  DEEPSEEK_BALANCE: 'DeepSeek 余额不足',
  DEEPSEEK_RATE_LIMIT: 'AI 分析触发限流',
  DEEPSEEK_INVALID_OUTPUT: 'AI 返回结构异常',
  DEEPSEEK_INCOMPLETE_REPORT: 'AI 报告不完整',
  DEEPSEEK_UPSTREAM: 'DeepSeek 上游异常',
  OCR_AUTH: 'OCR 密钥验证失败',
  OCR_RATE_LIMIT: 'OCR 触发限流',
  OCR_TIMEOUT: 'OCR 响应超时',
  OCR_EMPTY: 'OCR 未识别到有效文字',
  OCR_UPSTREAM: 'OCR 上游异常',
  SITE_RATE_LIMIT: '站点请求触发限流',
  REQUEST_TOO_LARGE: '上传内容超过限制',
  MATERIALS_TOO_SHORT: '材料内容过短',
  MATERIALS_TOO_LONG: '材料内容过长',
  INVALID_IMAGES: '图片材料无效',
  AI_NOT_CONFIGURED: 'DeepSeek 尚未配置',
  OCR_NOT_CONFIGURED: 'OCR 尚未配置',
};

function percentile50(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function percent(value: number, total: number) {
  return total ? value / total * 100 : null;
}

function delta(current: number | null, previous: number | null, suffix = '%') {
  if (current === null || previous === null) return '开始累计';
  const change = current - previous;
  if (Math.abs(change) < 0.05) return '与上期持平';
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}${suffix}`;
}

function countDelta(current: number, previous: number) {
  if (!previous) return current ? '开始累计' : '暂无请求';
  const change = (current - previous) / previous * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  return milliseconds >= 1_000 ? `${(milliseconds / 1_000).toFixed(1)}s` : `${milliseconds}ms`;
}

function buildSnapshot(rows: RuntimeEventRow[], now: number, windowMs: number, label: string): AdminRuntimeSnapshot {
  const start = now - windowMs;
  const previousStart = start - windowMs;
  const current = rows.filter((row) => row.occurred_at_ms >= start);
  const previous = rows.filter((row) => row.occurred_at_ms >= previousStart && row.occurred_at_ms < start);
  const successes = current.filter((row) => row.status === 'success').length;
  const previousSuccesses = previous.filter((row) => row.status === 'success').length;
  const successRate = percent(successes, current.length);
  const previousSuccessRate = percent(previousSuccesses, previous.length);
  const p50 = percentile50(current.map((row) => row.duration_ms));
  const previousP50 = percentile50(previous.map((row) => row.duration_ms));
  const failures = current.filter((row) => row.status === 'failure');
  const fallbackCount = current.filter((row) => row.status === 'fallback').length;

  const pipeline = (Object.keys(requestLabels) as RuntimeRequestType[]).map((requestType) => {
    const items = current.filter((row) => row.request_type === requestType);
    return {
      label: requestLabels[requestType],
      successRate: percent(items.filter((row) => row.status === 'success').length, items.length),
      total: items.length,
    };
  });
  const activePipeline = pipeline.filter((item) => item.total > 0 && item.successRate !== null);
  const lossPoint = activePipeline.length
    ? [...activePipeline].sort((a, b) => (a.successRate ?? 0) - (b.successRate ?? 0))[0].label
    : '暂无数据';

  const incidentMap = new Map<string, { count: number; latest: number }>();
  for (const row of failures) {
    const code = row.error_code || 'UNKNOWN_ERROR';
    const existing = incidentMap.get(code);
    incidentMap.set(code, { count: (existing?.count ?? 0) + 1, latest: Math.max(existing?.latest ?? 0, row.occurred_at_ms) });
  }
  const incidents = [...incidentMap.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest)
    .slice(0, 5)
    .map(([code, item]) => ({
      time: item.latest,
      title: errorLabels[code] ?? code.replaceAll('_', ' '),
      copy: `${label}内出现 ${item.count} 次，未保存任何用户材料原文。`,
      state: '待关注',
    }));

  return {
    label,
    kpis: [
      { label: '处理请求', value: String(current.length), delta: countDelta(current.length, previous.length), tone: 'blue' },
      { label: '成功率', value: successRate === null ? '—' : `${successRate.toFixed(1)}%`, delta: delta(successRate, previousSuccessRate), tone: 'green' },
      { label: 'P50 响应', value: formatDuration(p50), delta: p50 === null || previousP50 === null ? '开始累计' : `${p50 <= previousP50 ? '快' : '慢'} ${formatDuration(Math.abs(p50 - previousP50))}`, tone: 'violet' },
      { label: '失败请求', value: String(failures.length), delta: failures.length ? '需查看' : '运行正常', tone: 'orange' },
    ],
    pipeline,
    incidents,
    requests: current.slice(0, 30).map((row) => ({
      id: row.id,
      time: row.occurred_at_ms,
      type: requestLabels[row.request_type],
      model: row.model || row.provider,
      duration: formatDuration(row.duration_ms),
      status: row.status === 'success' ? '完成' : row.status === 'fallback' ? '已转为粘贴' : '失败',
    })),
    summary: { lossPoint, fallbackCount, failureCount: failures.length },
  };
}

function productProperties(row: ProductEventRow) {
  try { return JSON.parse(row.properties_json) as Record<string, unknown>; } catch { return {}; }
}

function buildProductSnapshot(rows: ProductEventRow[], now: number, windowMs: number): ProductAnalyticsSnapshot {
  const current = rows.filter((row) => row.occurred_at_ms >= now - windowMs);
  const count = (eventName: string, predicate?: (row: ProductEventRow) => boolean) => current
    .filter((row) => row.event_name === eventName && (!predicate || predicate(row))).length;
  const workspaceViews = count('page_view', (row) => row.page_path === '/match/new');
  const analysisStarts = count('analysis_started');
  const analysisCompleted = count('analysis_completed');
  const analysisFailures = count('analysis_failed');
  const exports = count('resume_exported');
  const suggestionReviews = current.filter((row) => row.event_name === 'suggestion_reviewed');
  const acceptedSuggestions = suggestionReviews.filter((row) => productProperties(row).decision === 'accepted').length;
  const analysisAttempts = analysisCompleted + analysisFailures;

  return {
    kpis: [
      { label: '匹配页访问', value: String(workspaceViews), note: '页面访问事件' },
      { label: '发起分析', value: String(analysisStarts), note: '点击分析事件' },
      { label: '分析完成', value: String(analysisCompleted), note: '完整结果返回' },
      { label: '导出动作', value: String(exports), note: 'HTML 与打印合计' },
    ],
    steps: [
      { key: 'workspace', label: '进入匹配页', count: workspaceViews },
      { key: 'resume', label: '简历材料就绪', count: count('resume_input_ready') },
      { key: 'jd', label: 'JD 材料就绪', count: count('jd_input_ready') },
      { key: 'analysis_start', label: '开始 AI 分析', count: analysisStarts },
      { key: 'analysis_complete', label: '获得完整结果', count: analysisCompleted },
      { key: 'review_confirm', label: '确认审核稿', count: count('review_draft_confirmed') },
      { key: 'export', label: '导出简历', count: exports },
    ],
    quality: {
      analysisSuccessRate: percent(analysisCompleted, analysisAttempts),
      suggestionAcceptanceRate: percent(acceptedSuggestions, suggestionReviews.length),
      analysisFailures,
    },
  };
}

const feedbackReasonLabels: Record<string, string> = {
  score_unfair: '评分不合理',
  evidence_missed: '漏掉已有经历',
  suggestions_weak: '建议不实用',
  unclear: '解释不清楚',
  other: '其他',
};

function buildFeedbackSnapshot(rows: FeedbackEventRow[], now: number, windowMs: number): FeedbackSnapshot {
  const current = rows.filter((row) => row.occurred_at_ms >= now - windowMs);
  const helpful = current.filter((row) => row.helpful === 1).length;
  const reasonCounts = current.filter((row) => row.helpful === 0).reduce<Record<string, number>>((counts, row) => {
    counts[row.reason] = (counts[row.reason] ?? 0) + 1;
    return counts;
  }, {});
  return {
    total: current.length,
    helpful,
    helpfulRate: percent(helpful, current.length),
    reasons: Object.entries(feedbackReasonLabels).map(([key, label]) => ({ key, label, count: reasonCounts[key] ?? 0 })),
  };
}

export async function getAdminRuntimeData(): Promise<AdminRuntimeData> {
  const now = Date.now();
  const [rows, sampleRows, productRows, feedbackRows] = await Promise.all([
    readRuntimeEvents(now - 60 * 24 * 60 * 60_000),
    readContentSamples(),
    readProductEvents(now - 60 * 24 * 60 * 60_000),
    readFeedbackEvents(now - 60 * 24 * 60 * 60_000),
  ]);
  const latestSuccess = (provider: string) => rows.find((row) => row.provider === provider && row.status === 'success')?.occurred_at_ms ?? null;
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '';
  return {
    ranges: {
      '24h': buildSnapshot(rows, now, 24 * 60 * 60_000, '最近 24 小时'),
      '7d': buildSnapshot(rows, now, 7 * 24 * 60 * 60_000, '最近 7 天'),
      '30d': buildSnapshot(rows, now, 30 * 24 * 60 * 60_000, '最近 30 天'),
    },
    productRanges: {
      '24h': buildProductSnapshot(productRows, now, 24 * 60 * 60_000),
      '7d': buildProductSnapshot(productRows, now, 7 * 24 * 60 * 60_000),
      '30d': buildProductSnapshot(productRows, now, 30 * 24 * 60 * 60_000),
    },
    feedbackRanges: {
      '24h': buildFeedbackSnapshot(feedbackRows, now, 24 * 60 * 60_000),
      '7d': buildFeedbackSnapshot(feedbackRows, now, 7 * 24 * 60 * 60_000),
      '30d': buildFeedbackSnapshot(feedbackRows, now, 30 * 24 * 60 * 60_000),
    },
    hasData: rows.length > 0 || productRows.length > 0 || feedbackRows.length > 0,
    samples: sampleRows.map((row) => ({
      reference: row.public_id,
      time: row.occurred_at_ms,
      expiresAt: row.expires_at_ms,
      language: row.language,
      resumeText: row.resume_text,
      jdText: row.jd_text,
      score: row.score,
      grade: row.grade,
      summary: row.summary,
    })),
    providers: {
      deepseek: { configured: Boolean(process.env.DEEPSEEK_API_KEY), model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash', lastSuccess: latestSuccess('deepseek') },
      zhipu: { configured: Boolean(process.env.ZHIPU_API_KEY), model: process.env.ZHIPU_VISION_MODEL || 'glm-4.6v-flash', lastSuccess: latestSuccess('zhipu') },
      ga4: { configured: /^G-[A-Z0-9]+$/.test(gaMeasurementId), measurementId: gaMeasurementId },
    },
  };
}
