import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth';

export const dynamic = 'force-dynamic';

export default function Home() {
  const user = getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
