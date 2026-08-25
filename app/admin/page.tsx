import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminDashboard from './admin-dashboard';
import { chatGPTSignOutPath, requireChatGPTUser } from '../chatgpt-auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — ResumeProof Match',
  description: 'ResumeProof Match operations dashboard prototype.',
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

  return (
    <AdminDashboard
      adminName={user.displayName}
      adminEmail={user.email}
      signOutPath={chatGPTSignOutPath('/')}
    />
  );
}
