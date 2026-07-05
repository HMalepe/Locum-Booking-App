'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav({ role, unread, pending }) {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', icon: '🏠', label: 'Home' },
    { href: '/shifts', icon: '📋', label: 'Shifts' },
    { href: '/locums', icon: '👥', label: 'Locums' },
    { href: '/messages', icon: '💬', label: 'Messages', badge: unread },
    role === 'locum'
      ? { href: '/schedule', icon: '📅', label: 'Schedule' }
      : { href: '/requests', icon: '📨', label: 'Requests', badge: pending },
  ];

  return (
    <nav className="bottomnav">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname.startsWith(item.href) ? 'active' : ''}
        >
          <span className="icon">{item.icon}</span>
          {item.label}
          {item.badge > 0 && <span className="badge-dot">{item.badge > 9 ? '9+' : item.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
