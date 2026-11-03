/** Keep programmatic navigation aligned with the visitor's motion preference. */
export function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

export function scrollToWorkspaceTop() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
}

export function focusWorkspaceSection(id: string) {
  if (typeof document === 'undefined') return;
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
  section.focus({ preventScroll: true });
}
