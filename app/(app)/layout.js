import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import { getUnreadCount, getPendingCounts } from '../../lib/queries';
import { logout } from '../../lib/actions';
import BottomNav from '../../components/BottomNav';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }) {
  const user = getCurrentUser();
  if (!user) redirect('/login');

  const unread = getUnreadCount(user.id);
  const counts = getPendingCounts(user);
  const pending = user.role === 'locum' ? counts.requests : counts.applications;

  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="logo">💊 Locum Planner</Link>
        <div className="who">
          {user.name.split(' ')[0]} · {user.employee_number}
          <form action={logout}>
            <button className="linklike" type="submit">Log out</button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
      <BottomNav role={user.role} unread={unread} pending={pending} />
    </>
  );
}
