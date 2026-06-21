import React from 'react';
import { UserAvatar } from '../components';
import { useLogout } from '../hooks/useAuth';
import { useAppStore } from '../store/appStore';
import { CLIENT_NAV } from './constants';

// РСТ brand mark — shared between the desktop header and the mobile top bar.
const BrandLogo: React.FC<{ width?: number; height?: number }> = ({ width = 36, height = 22 }) => (
  <svg width={width} height={height} viewBox="0 0 68 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M67.5521 14.6045C66.8811 10.9294 64.5805 7.68397 60.938 5.20215C53.8446 0.33395 41.9584 -1.24106 30.0243 1.00213C18.1861 3.24532 7.83361 9.06807 2.99287 16.1795C0.452681 19.8545 -0.457951 23.7681 0.213043 27.4909C0.931965 31.1659 3.28044 34.4113 6.97091 36.8932C11.9554 40.2341 19.1446 42 27.0528 42C30.5036 42 34.1461 41.6659 37.7408 40.95C49.579 38.7068 59.9315 32.8841 64.7722 25.7727C67.3124 22.1454 68.271 18.2795 67.5521 14.6045Z" fill="#E20813"/>
    <path d="M60.7459 15.9402C60.3146 13.5539 59.1643 11.3107 57.4868 9.40157C57.343 9.25839 57.1992 9.11521 57.0554 8.97202C56.9596 8.87657 56.8637 8.73339 56.7199 8.63793C56.672 8.5902 56.6241 8.54248 56.5762 8.49475C55.8572 7.77884 54.9945 7.11065 54.0839 6.4902C51.4479 4.67655 48.1887 3.43564 44.6421 2.71973C40.2327 1.86063 35.2961 1.81291 30.3595 2.76746C25.4229 3.72201 20.8697 5.48792 17.0834 7.92202C16.9396 8.01747 16.7958 8.11293 16.652 8.20838C16.4603 8.35156 16.2686 8.44702 16.1248 8.5902C15.8852 8.73339 15.6455 8.9243 15.4538 9.06748C13.1054 10.7857 11.1403 12.7902 9.65453 14.938C9.03147 15.8925 8.45633 16.8471 8.02498 17.8493C6.82677 20.6175 6.44335 23.4812 6.97056 26.2494C7.2102 27.4903 7.68948 28.6835 8.26462 29.8289C8.31254 29.9244 8.36047 29.9721 8.4084 30.0675C8.45633 30.163 8.50426 30.2585 8.55219 30.3062C9.27111 31.5471 10.2297 32.6926 11.332 33.7426C14.2556 36.5108 18.4254 38.5153 23.2182 39.4699C25.375 39.8994 27.6755 40.138 30.0719 40.138C32.4683 40.138 34.9127 39.8994 37.4049 39.4221C42.5332 38.4676 47.2302 36.5108 51.1124 33.9335C53.988 32.0244 56.3845 29.7335 58.0619 27.2039C58.1578 27.0607 58.2536 26.9175 58.3495 26.7266C58.4454 26.5834 58.5412 26.3925 58.6371 26.2494C58.7329 26.1062 58.8288 25.9153 58.9246 25.7721C59.2122 25.2948 59.4518 24.7698 59.6436 24.2925C60.9376 21.4766 61.321 18.6607 60.7459 15.9402ZM26.2377 14.6039L26.2856 14.5084C26.9566 11.7879 30.024 9.59248 33.9062 8.68566C32.7559 10.1652 32.1807 11.9789 32.2287 13.8879C32.2287 14.3175 32.2766 14.6516 32.2766 15.0334C32.3725 16.5607 32.4683 17.897 31.7015 20.713V20.8084C31.4139 22.1448 32.1328 23.2425 32.6121 23.9584L29.6406 31.5948H19.9111L26.2377 14.6039Z" fill="white"/>
    <path d="M39.7055 7.30176C42.3415 7.68358 46.032 9.30631 45.0734 14.1268C44.3066 18.1836 41.1912 18.8518 39.8493 20.1882C37.5966 21.4291 38.6031 24.0541 35.4878 24.0064C36.5901 24.1495 37.5008 24.1018 37.8363 24.1018C44.9296 24.1018 50.7289 20.3791 50.7289 15.6541C50.7289 11.4063 45.9841 7.87449 39.7055 7.30176Z" fill="#E20813"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M31.7004 20.7605V20.665C32.4672 17.8968 32.3714 16.5605 32.2755 14.9854C32.2276 14.6036 32.2276 14.2218 32.2276 13.84C32.1797 11.9309 32.7548 10.1172 33.9051 8.6377C29.975 9.54452 26.9555 11.74 26.2845 14.4604L26.2366 14.5559L19.958 31.4991H29.6874L32.659 23.8627C32.1318 23.2423 31.4608 22.0968 31.7004 20.7605Z" fill="#124193"/>
  </svg>
);

const LogoutIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const BellIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);

const HomeTabIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z"/>
  </svg>
);

const PlusTabIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const PersonTabIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const MOBILE_TABS: Array<{
  id: string;
  label: string;
  Icon: React.FC<{ active?: boolean }>;
}> = [
  { id: 'tickets',     label: 'Заявки',  Icon: HomeTabIcon },
  { id: 'tickets-new', label: 'Создать', Icon: PlusTabIcon },
  { id: 'profile',     label: 'Профиль', Icon: PersonTabIcon },
];

interface ClientShellProps {
  screen: string;
  onNav: (screen: string) => void;
  mobile: boolean;
  children: React.ReactNode;
}

export const ClientShell: React.FC<ClientShellProps> = ({ screen, onNav, mobile, children }) => {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const currentUser = useAppStore(s => s.currentUser);
  const notifications = useAppStore(s => s.notifications);
  const userName = currentUser?.name ?? 'Клиент';
  const hasUnread = notifications.some(n => !n.read);

  if (mobile) {
    return (
      <div className="client-mobile">
        {/* Sticky top bar: brand + notifications + avatar + logout */}
        <header className="client-mobile__bar">
          <button className="client-mobile__brand" onClick={() => onNav('tickets')} title="На главную">
            <BrandLogo width={30} height={18} />
            <span className="client-mobile__brand-text">Клиентский портал</span>
          </button>
          <div className="client-mobile__bar-actions">
            <button
              className="iconbtn"
              style={{ width: 34, height: 34, position: 'relative' }}
              onClick={() => onNav('notifications')}
              title="Уведомления"
            >
              <BellIcon />
              {hasUnread && <span className="iconbtn__dot" />}
            </button>
            <UserAvatar userId={currentUser?.id ?? 'u12'} name={currentUser?.name} color={currentUser?.color} size="sm" bordered={false} />
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              title="Выйти"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--c-gray-500)', display: 'flex', alignItems: 'center', opacity: isLoggingOut ? 0.4 : 1 }}
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="client-mobile__content">
          {children}
        </div>

        {/* Bottom tab bar — respects the home-indicator safe area */}
        <nav className="client-mobile__tabbar">
          {MOBILE_TABS.map(({ id, label, Icon }) => {
            const active = screen === id;
            const isCreate = id === 'tickets-new';
            return (
              <button
                key={id}
                className="client-mobile__tab"
                data-active={active}
                data-accent={isCreate}
                onClick={() => onNav(id)}
                aria-label={label}
              >
                <span className="client-mobile__tab-icon">
                  <Icon active={active} />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="shell-client">
      {/* Header */}
      <header className="client-header">
        <div className="client-header__inner">
          <div className="client-header__brand">
            <BrandLogo width={36} height={22} />
            <div className="client-header__brand-sub">Клиентский портал</div>
          </div>

          <nav className="client-header__nav">
            {CLIENT_NAV.map((item) => (
              <button
                key={item.id}
                className="client-header__nav-item"
                data-active={screen === item.id}
                onClick={() => onNav(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="client-header__right">
            <button
              className="iconbtn"
              style={{ position: 'relative' }}
              onClick={() => onNav('notifications')}
              title="Уведомления"
            >
              <BellIcon />
              {hasUnread && <span className="iconbtn__dot" />}
            </button>
            <div className="client-header__user-pill">
              <UserAvatar userId={currentUser?.id ?? 'u12'} name={currentUser?.name} color={currentUser?.color} size="xs" bordered={false} />
              <span>{userName}</span>
            </div>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              title="Выйти"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 13,
                color: 'var(--c-gray-600)',
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                opacity: isLoggingOut ? 0.5 : 1,
              }}
            >
              <LogoutIcon />
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="client-page">
        {children}
      </main>
    </div>
  );
};
