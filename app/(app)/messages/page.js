import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import { getConversations } from '../../../lib/queries';
import { initials, typeLabel } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default function MessagesPage() {
  const user = getCurrentUser();
  const conversations = getConversations(user.id);

  return (
    <>
      <h1>Messages</h1>
      <p style={{ color: 'var(--muted)' }}>Private chats with locums and managers.</p>

      {conversations.length === 0 ? (
        <div className="empty">
          No conversations yet. Open a <Link href="/locums">locum&apos;s profile</Link> and tap “Message” to start one.
        </div>
      ) : (
        conversations.map((c) => (
          <Link href={`/messages/${c.id}`} key={c.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div className="card-row">
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div className="avatar">{initials(c.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{c.name}</h3>
                    <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last_sender_id === user.id ? 'You: ' : ''}{c.last_body}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="pill off">{c.role === 'locum' ? typeLabel(c.locum_type) : 'Manager'}</span>
                  {c.unread > 0 && <span className="pill danger">{c.unread} new</span>}
                </div>
              </div>
            </div>
          </Link>
        ))
      )}
    </>
  );
}
