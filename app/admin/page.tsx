import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminDashboard from './admin-dashboard';

export const metadata: Metadata = {
  title: 'Admin — ResumeProof Match',
  description: 'ResumeProof Match operations dashboard prototype.',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_ENABLED !== 'true') notFound();
  return <AdminDashboard />;
}
