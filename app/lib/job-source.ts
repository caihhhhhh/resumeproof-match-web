export type JobSource = 'boss' | 'liepin' | 'linkedin' | 'greenhouse' | 'lever' | 'ashby' | 'unknown';

export function identifyJobSource(value: string): JobSource {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'zhipin.com' || host.endsWith('.zhipin.com')) return 'boss';
    if (host === 'liepin.com' || host.endsWith('.liepin.com')) return 'liepin';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'greenhouse.io' || host.endsWith('.greenhouse.io')) return 'greenhouse';
    if (host === 'lever.co' || host.endsWith('.lever.co')) return 'lever';
    if (host === 'ashbyhq.com' || host.endsWith('.ashbyhq.com')) return 'ashby';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export const sourceLabels: Record<JobSource, string> = {
  boss: 'BOSS 直聘',
  liepin: '猎聘',
  linkedin: 'LinkedIn',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  unknown: 'Unknown',
};
