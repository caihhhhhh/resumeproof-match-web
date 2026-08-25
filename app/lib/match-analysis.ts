export type EvidenceStatus = 'strong' | 'partial' | 'gap';
export type RequirementImportance = 'must' | 'important' | 'bonus';

export type ScoreBreakdown = {
  mustCoverage: number | null;
  importantCoverage: number | null;
  bonusCoverage: number | null;
  verifiedEvidence: number;
  totalRequirements: number;
  strongCount: number;
  partialCount: number;
  gapCount: number;
};

export type EvidenceItem = {
  requirement: string;
  importance: RequirementImportance;
  resumeEvidence: string[];
  rationale: string;
  status: EvidenceStatus;
};

export type OptimizationSuggestion = {
  id: string;
  kind: 'rewrite' | 'reorder' | 'fact_check';
  targetSection: string;
  originalText: string;
  sourceStart: number;
  sourceEnd: number;
  revisedText: string;
  rationale: string;
  expectedImpact: string;
  relatedRequirement: string;
  requiresFact: boolean;
};

export type MatchAnalysis = {
  mode: 'ai';
  summary: string;
  overall: number;
  grade: 'A' | 'B' | 'C';
  scoring: ScoreBreakdown;
  coveredTerms: string[];
  missingTerms: string[];
  evidence: EvidenceItem[];
  metricSignals: number;
  suggestions: OptimizationSuggestion[];
};

export function isMatchAnalysis(value: unknown): value is MatchAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<MatchAnalysis>;
  const scoring = analysis.scoring as Partial<ScoreBreakdown> | undefined;
  return analysis.mode === 'ai'
    && typeof analysis.summary === 'string' && analysis.summary.trim().length > 0
    && typeof analysis.overall === 'number' && Number.isInteger(analysis.overall) && analysis.overall >= 0 && analysis.overall <= 100
    && (analysis.grade === 'A' || analysis.grade === 'B' || analysis.grade === 'C')
    && Boolean(scoring) && typeof scoring?.verifiedEvidence === 'number'
    && typeof scoring?.totalRequirements === 'number' && scoring.totalRequirements >= 3
    && typeof scoring?.strongCount === 'number' && typeof scoring?.partialCount === 'number' && typeof scoring?.gapCount === 'number'
    && Array.isArray(analysis.coveredTerms) && analysis.coveredTerms.some((item) => typeof item === 'string' && item.trim())
    && Array.isArray(analysis.missingTerms) && analysis.missingTerms.some((item) => typeof item === 'string' && item.trim())
    && Array.isArray(analysis.evidence) && analysis.evidence.length >= 3
    && analysis.evidence.every((item) => typeof item.requirement === 'string' && item.requirement.trim()
      && typeof item.rationale === 'string' && item.rationale.trim() && Array.isArray(item.resumeEvidence)
      && ['strong', 'partial', 'gap'].includes(item.status))
    && analysis.evidence.some((item) => item.resumeEvidence.length > 0)
    && Array.isArray(analysis.suggestions)
    && analysis.suggestions.every((item) => typeof item.originalText === 'string' && item.originalText.trim()
      && typeof item.sourceStart === 'number' && Number.isInteger(item.sourceStart) && item.sourceStart >= 0
      && typeof item.sourceEnd === 'number' && Number.isInteger(item.sourceEnd) && item.sourceEnd > item.sourceStart
      && typeof item.revisedText === 'string' && item.revisedText.trim()
      && typeof item.rationale === 'string' && item.rationale.trim()
      && typeof item.expectedImpact === 'string' && item.expectedImpact.trim()
      && typeof item.relatedRequirement === 'string' && item.relatedRequirement.trim());
}
