import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminDashboard from './admin-dashboard';
import { chatGPTSignOutPath, requireChatGPTUser } from '../chatgpt-auth';
import { getAdminRuntimeData } from '../lib/admin-runtime';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — ResumeProof Match',
  description: 'ResumeProof Match private operations dashboard.',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isLocalPreview = process.env.NODE_ENV !== 'production';
  if (!isLocalPreview && !allowedEmails.includes(user.email.toLowerCase())) notFound();
  const runtimeData = await getAdminRuntimeData();
  const configuredOrigin = process.env.SITE_URL?.trim();
  const siteOrigin = configuredOrigin && /^https:\/\//i.test(configuredOrigin)
    ? configuredOrigin.replace(/\/$/, '')
    : 'https://resumeproof.szw19990924.chatgpt.site';

  return (
    <AdminDashboard
      adminName={user.displayName}
      adminEmail={user.email}
      signOutPath={chatGPTSignOutPath('/')}
      siteOrigin={siteOrigin}
      runtimeData={runtimeData}
    />
  );
}
