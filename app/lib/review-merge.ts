import type { ReviewBlock } from '../components/resume-document';

// Merge regenerated suggestions only into paragraphs the user has not edited.
export function mergeReview(current: ReviewBlock[], before: ReviewBlock[], after: ReviewBlock[]) {
  if (before.length !== after.length) return { blocks: current, conflicts: 1 };
  const blocks = current.map((block) => ({ ...block }));
  let conflicts = 0;
  before.forEach((old, index) => {
    const next = after[index];
    if (old.text === next.text && old.kind === next.kind) return;
    const matches = blocks.map((block, i) => block.text === old.text && block.kind === old.kind ? i : -1).filter((i) => i >= 0);
    if (matches.length === 1) blocks[matches[0]] = { ...next };
    else if (!blocks.some((block) => block.text === next.text && block.kind === next.kind)) conflicts++;
  });
  return { blocks, conflicts };
}
