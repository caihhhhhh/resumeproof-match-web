import { guardApiRequest, privateJson } from '../../../lib/request-guard';
import { trackRuntimeResponse } from '../../../lib/runtime-telemetry';

export const runtime = 'nodejs';

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MAX_IMAGES = 6;
const MAX_IMAGE_LENGTH = 6_500_000;
const RETRY_DELAYS = [900, 2_200];

type VisionContent = {
  type?: string;
  text?: string;
};

function readMessageText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => (item && typeof item === 'object' ? (item as VisionContent).text ?? '' : ''))
    .filter(Boolean)
    .join('\n');
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/^```(?:markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const model = process.env.ZHIPU_VISION_MODEL?.trim() || 'glm-4.6v-flash';
  let inputTokens = 0;
  let outputTokens = 0;
  let usageReported = false;
  const done = (response: Response) => trackRuntimeResponse(startedAt, {
    requestType: 'ocr', provider: 'zhipu', model, source: 'upload', method: 'vision_ocr',
    inputTokens, outputTokens,
    estimatedCostMicrousd: usageReported && model.toLowerCase() === 'glm-4.6v-flash' ? 0 : null,
  }, response);
  const blocked = guardApiRequest(request, { bucket: 'resume-ocr', limit: 6, maxBytes: 42 * 1024 * 1024 });
  if (blocked) return done(blocked);
  const apiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!apiKey) return done(privateJson({ error: 'OCR_NOT_CONFIGURED' }, { status: 503 }));

  let body: { images?: unknown; filename?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return done(privateJson({ error: 'INVALID_REQUEST' }, { status: 400 }));
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  if (!images.length || images.length > MAX_IMAGES || images.some((image) => image.length > MAX_IMAGE_LENGTH)) {
    return done(privateJson({ error: 'INVALID_IMAGES' }, { status: 400 }));
  }

  const outputLanguage = body.language === 'en' ? 'English' : 'Chinese or the source language';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);

  try {
    const requestBody = JSON.stringify({
      model,
      stream: false,
      thinking: { type: 'disabled' },
      max_tokens: 12_000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            {
              type: 'text',
              text: `Transcribe this resume exactly and return only editable plain text. The pages are in order. Preserve headings, paragraph order, bullet points, dates, company names, job titles, metrics, URLs, and the original language. Use • for bullet points, but do not add Markdown heading markers, code fences, tables, commentary, or explanations. Do not summarize, rewrite, translate, correct, infer, or add anything. Mark unreadable text as [无法识别]. The interface language is ${outputLanguage}.`,
            },
          ],
        },
      ],
    });

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
      const response = await fetch(ZHIPU_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        error?: { code?: string | number; message?: string };
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      } | null;

      if (response.status === 429 && attempt < RETRY_DELAYS.length) {
        await delay(RETRY_DELAYS[attempt]);
        continue;
      }
      if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : 502;
        return done(privateJson({ error: status === 401 ? 'OCR_AUTH' : status === 429 ? 'OCR_RATE_LIMIT' : 'OCR_UPSTREAM' }, { status }));
      }

      if (payload?.usage) {
        usageReported = true;
        inputTokens = Math.max(0, Math.round(payload.usage.prompt_tokens ?? 0));
        outputTokens = Math.max(0, Math.round(payload.usage.completion_tokens ?? 0));
      }

      const text = cleanExtractedText(readMessageText(payload?.choices?.[0]?.message?.content));
      if (text.length < 40) return done(privateJson({ error: 'OCR_EMPTY' }, { status: 422 }));
      return done(privateJson({ text, model }));
    }

    return done(privateJson({ error: 'OCR_RATE_LIMIT' }, { status: 429 }));
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return done(privateJson({ error: timedOut ? 'OCR_TIMEOUT' : 'OCR_UPSTREAM' }, { status: timedOut ? 504 : 502 }));
  } finally {
    clearTimeout(timeout);
  }
}
