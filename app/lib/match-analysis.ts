export type EvidenceStatus = 'strong' | 'partial' | 'gap';
export type RequirementImportance = 'must' | 'important' | 'bonus';
export type HardRequirementStatus = 'met' | 'unverified' | 'not_met';
export type ApplicationDecision = 'apply' | 'review_first' | 'skip';

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

export type HardRequirement = {
  requirement: string;
  category: 'location' | 'work_authorization' | 'education' | 'experience' | 'language' | 'industry' | 'certification' | 'other';
  status: HardRequirementStatus;
  resumeEvidence: string[];
  rationale: string;
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
  suggestionStatus?: 'ready' | 'unavailable';
  mode: 'ai';
  summary: string;
  overall: number;
  grade: 'A' | 'B' | 'C';
  decision: ApplicationDecision;
  hardRequirements: HardRequirement[];
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
    && (analysis.decision === 'apply' || analysis.decision === 'review_first' || analysis.decision === 'skip')
    && Array.isArray(analysis.hardRequirements)
    && analysis.hardRequirements.every((item) => typeof item.requirement === 'string' && item.requirement.trim()
      && ['location', 'work_authorization', 'education', 'experience', 'language', 'industry', 'certification', 'other'].includes(item.category)
      && ['met', 'unverified', 'not_met'].includes(item.status)
      && Array.isArray(item.resumeEvidence)
      && typeof item.rationale === 'string' && item.rationale.trim())
    && Boolean(scoring) && typeof scoring?.verifiedEvidence === 'number'
    && typeof scoring?.totalRequirements === 'number' && scoring.totalRequirements >= 1
    && typeof scoring?.strongCount === 'number' && typeof scoring?.partialCount === 'number' && typeof scoring?.gapCount === 'number'
    && Array.isArray(analysis.coveredTerms) && analysis.coveredTerms.every((item) => typeof item === 'string')
    && Array.isArray(analysis.missingTerms) && analysis.missingTerms.every((item) => typeof item === 'string')
    && Array.isArray(analysis.evidence) && analysis.evidence.length >= 1
    && analysis.evidence.every((item) => typeof item.requirement === 'string' && item.requirement.trim()
      && typeof item.rationale === 'string' && item.rationale.trim() && Array.isArray(item.resumeEvidence)
      && ['strong', 'partial', 'gap'].includes(item.status))
    && Array.isArray(analysis.suggestions)
    && analysis.suggestions.every((item) => typeof item.originalText === 'string' && item.originalText.trim()
      && typeof item.sourceStart === 'number' && Number.isInteger(item.sourceStart) && item.sourceStart >= 0
      && typeof item.sourceEnd === 'number' && Number.isInteger(item.sourceEnd) && item.sourceEnd > item.sourceStart
      && typeof item.revisedText === 'string' && item.revisedText.trim()
      && typeof item.rationale === 'string' && item.rationale.trim()
      && typeof item.expectedImpact === 'string' && item.expectedImpact.trim()
      && typeof item.relatedRequirement === 'string' && item.relatedRequirement.trim());
}
