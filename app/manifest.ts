import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ResumeProof Match',
    short_name: 'ResumeProof',
    description: 'Evidence-first AI resume and job-description matching.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5ef',
    theme_color: '#315acb',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
