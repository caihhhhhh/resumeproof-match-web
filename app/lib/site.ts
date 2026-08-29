export const SITE_ORIGIN = (process.env.SITE_URL?.startsWith('https://')
  ? process.env.SITE_URL
  : 'https://resumeproof.szw19990924.chatgpt.site').replace(/\/$/, '');
