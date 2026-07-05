import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth';
import { getUser, getThread } from '../../../../lib/queries';
import { sendMessage } from '../../../../lib/actions';
import { initials, typeLabel, jobTitleLabel } from '../../../../lib/format';
import AutoRefresh from '../../../../components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default function ThreadPage({ params }) {
  const user = getCurrentUser();
  const other = getUser(Number(params.id));
  if (!other || other.id === user.id) notFound();

  const thread = getThread(user.id, other.id);

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <Link href="/messages">← All messages</Link>

      <div className="card" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div className="avatar">{initials(other.name)}</div>
        <div>
          <h3 style={{ margin: 0 }}>
            {other.role === 'locum' ? <Link href={`/locums/${other.id}`}>{other.name}</Link> : other.name}
          </h3>
          <div className="meta" style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            {other.role === 'locum' ? `${typeLabel(other.locum_type)} · ${other.employee_number}` : `${jobTitleLabel(other.job_title)} · ${other.pharmacy_name || ''}`}
          </div>
        </div>
      </div>

      <div className="thread">
        {thread.length === 0 && (
          <div className="empty">No messages yet — say hi 👋</div>
        )}
        {thread.map((m) => (
          <div className={`bubble ${m.sender_id === user.id ? 'mine' : 'theirs'}`} key={m.id}>
            {m.body}
            <span className="time">{m.created_at.slice(11, 16)} · {m.created_at.slice(0, 10)}</span>
          </div>
        ))}
      </div>

      <form action={sendMessage} className="composer">
        <input type="hidden" name="recipient_id" value={other.id} />
        <input name="body" placeholder={`Message ${other.name.split(' ')[0]}…`} autoComplete="off" required />
        <button className="btn" type="submit">Send</button>
      </form>
    </>
  );
}
