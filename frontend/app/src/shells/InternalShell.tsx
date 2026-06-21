import React from 'react';
import { CloseOutlined } from '@ant-design/icons';
import type { Role } from '../types';
import { UserAvatar } from '../components';
import { SidebarIcon } from './SidebarIcon';
import type { IconName } from './SidebarIcon';
import { useAppStore } from '../store/appStore';
import { useLogout } from '../hooks/useAuth';
import { ROLE_LABEL, CURRENT_USER_BY_ROLE } from './constants';

export { SidebarIcon } from './SidebarIcon';

const INTERNAL_NAV: Record<string, Array<{
  section?: string;
  id?: string;
  label?: string;
  icon?: IconName;
  accent?: boolean;
}>> = {
  manager: [
    { section: 'Работа' },
    { id: 'dashboard',     label: 'Дашборд',      icon: 'dashboard' },
    { id: 'tasks',         label: 'Задачи',        icon: 'list' },
    { id: 'review',        label: 'На проверке',   icon: 'eye' },
    { id: 'tickets',       label: 'Заявки',        icon: 'inbox', accent: true },
    { id: 'analytics',     label: 'Аналитика',     icon: 'chart' },
    { section: 'Управление' },
    { id: 'teams',         label: 'Команды',       icon: 'team' },
    { section: 'Настройки' },
    { id: 'services',      label: 'Сервисы и приложения', icon: 'tag' },
    { id: 'notifications', label: 'Уведомления',   icon: 'bell' },
  ],
  teamlead: [
    { section: 'Работа' },
    { id: 'team-dashboard', label: 'Дашборд команды', icon: 'dashboard' },
    { id: 'tasks',           label: 'Задачи команды',  icon: 'list' },
    { id: 'decompose',       label: 'Декомпозиция',    icon: 'layers' },
    { id: 'analytics',       label: 'Аналитика',       icon: 'chart' },
    { section: 'Прочее' },
    { id: 'notifications', label: 'Уведомления', icon: 'bell' },
  ],
  worker: [
    { section: 'Моя работа' },
    { id: 'my-tasks',      label: 'Мои подзадачи', icon: 'list' },
    { id: 'notifications', label: 'Уведомления',   icon: 'bell' },
    { id: 'profile',       label: 'Профиль',        icon: 'user' },
  ],
  admin: [
    { section: 'Администрирование' },
    { id: 'users',     label: 'Пользователи',   icon: 'users' },
    { id: 'teams',     label: 'Команды',         icon: 'team' },
    { id: 'audit-log', label: 'Журнал действий', icon: 'history' },
    { section: 'Настройки' },
    { id: 'services', label: 'Сервисы', icon: 'tag' },
  ],
};

const USER_NAME_BY_ID: Record<string, string> = {
  u1:  'Алексей Петров',
  u2:  'Мария Соколова',
  u4:  'Анна Иванова',
  u11: 'Михаил Дьяков',
  u12: 'Пользователь',
};

interface InternalShellProps {
  role: Role;
  screen: string;
  onNav: (screen: string) => void;
  crumbs: string[];
  onCreate?: () => void;
  children: React.ReactNode;
}

export const InternalShell: React.FC<InternalShellProps> = ({
  role,
  screen,
  onNav,
  crumbs,
  onCreate,
  children,
}) => {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const tasks = useAppStore(s => s.tasks);
  const tickets = useAppStore(s => s.tickets);
  const notifications = useAppStore(s => s.notifications);
  const setScreen = useAppStore(s => s.setScreen);
  const currentUser = useAppStore(s => s.currentUser);
  const items = INTERNAL_NAV[role] ?? INTERNAL_NAV['manager'];
  const userId = currentUser?.id ?? CURRENT_USER_BY_ROLE[role] ?? 'u1';
  const userName = currentUser?.name ?? USER_NAME_BY_ID[userId] ?? 'Пользователь';

  const searchTarget = role === 'worker' ? 'my-tasks' : role === 'admin' ? 'audit-log' : 'tasks';

  const [sidebarQ, setSidebarQ] = React.useState('');
  const [topbarQ, setTopbarQ] = React.useState('');

  const myTeam = currentUser?.team ?? '';
  const badgeCounts: Record<string, number> = {
    tasks: tasks.filter(t => !['done', 'archive'].includes(t.status)).length,
    tickets: tickets.filter(t => ['new', 'accepted'].includes(t.status)).length,
    'team-dashboard': tasks.filter(t => !['done', 'archive'].includes(t.status) && (!myTeam || t.team === myTeam)).length,
    'my-tasks': tasks.filter(t => !['done', 'archive'].includes(t.status)).length,
    notifications: notifications.filter(n => !n.read).length,
    users: 0,
  };

  const filteredItems = React.useMemo(() => {
    if (!sidebarQ) return items;
    const q = sidebarQ.toLowerCase();
    const matchingIds = new Set(
      items
        .filter(it => it.id && it.label && it.label.toLowerCase().includes(q))
        .map(it => it.id as string)
    );
    const result: typeof items = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.section) {
        let hasmatch = false;
        for (let j = i + 1; j < items.length; j++) {
          if (items[j].section) break;
          if (items[j].id && matchingIds.has(items[j].id as string)) {
            hasmatch = true;
            break;
          }
        }
        if (hasmatch) result.push(it);
      } else {
        if (it.id && matchingIds.has(it.id as string)) result.push(it);
      }
    }
    return result;
  }, [items, sidebarQ]);

  return (
    <div className="shell-internal">
      {}
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <svg width="170" viewBox="0 0 302 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <path d="M60.7459 15.9402C60.3146 13.5539 59.1643 11.3107 57.4868 9.40157C57.343 9.25839 57.1992 9.11521 57.0554 8.97202C56.9596 8.87657 56.8637 8.73339 56.7199 8.63793C56.672 8.5902 56.6241 8.54248 56.5762 8.49475C55.8572 7.77884 54.9945 7.11065 54.0839 6.4902C51.4479 4.67655 48.1887 3.43564 44.6421 2.71973C40.2327 1.86063 35.2961 1.81291 30.3595 2.76746C25.4229 3.72201 20.8697 5.48792 17.0834 7.92202C16.9396 8.01747 16.7958 8.11293 16.652 8.20838C16.4603 8.35156 16.2686 8.44702 16.1248 8.5902C15.8852 8.73339 15.6455 8.9243 15.4538 9.06748C13.1054 10.7857 11.1403 12.7902 9.65453 14.938C9.03147 15.8925 8.45633 16.8471 8.02498 17.8493C6.82677 20.6175 6.44335 23.4812 6.97056 26.2494C7.2102 27.4903 7.68948 28.6835 8.26462 29.8289C8.31254 29.9244 8.36047 29.9721 8.4084 30.0675C8.45633 30.163 8.50426 30.2585 8.55219 30.3062C9.27111 31.5471 10.2297 32.6926 11.332 33.7426C14.2556 36.5108 18.4254 38.5153 23.2182 39.4699C25.375 39.8994 27.6755 40.138 30.0719 40.138C32.4683 40.138 34.9127 39.8994 37.4049 39.4221C42.5332 38.4676 47.2302 36.5108 51.1124 33.9335C53.988 32.0244 56.3845 29.7335 58.0619 27.2039C58.1578 27.0607 58.2536 26.9175 58.3495 26.7266C58.4454 26.5834 58.5412 26.3925 58.6371 26.2494C58.7329 26.1062 58.8288 25.9153 58.9246 25.7721C59.2122 25.2948 59.4518 24.7698 59.6436 24.2925C60.9376 21.4766 61.321 18.6607 60.7459 15.9402ZM26.2377 14.6039L26.2856 14.5084C26.9566 11.7879 30.024 9.59248 33.9062 8.68566C32.7559 10.1652 32.1807 11.9789 32.2287 13.8879C32.2287 14.3175 32.2766 14.6516 32.2766 15.0334C32.3725 16.5607 32.4683 17.897 31.7015 20.713V20.8084C31.4139 22.1448 32.1328 23.2425 32.6121 23.9584L29.6406 31.5948H19.9111L26.2377 14.6039Z" fill="white"/>
              <path d="M39.7055 7.30176C42.3415 7.68358 46.032 9.30631 45.0734 14.1268C44.3066 18.1836 41.1912 18.8518 39.8493 20.1882C37.5966 21.4291 38.6031 24.0541 35.4878 24.0064C36.5901 24.1495 37.5008 24.1018 37.8363 24.1018C44.9296 24.1018 50.7289 20.3791 50.7289 15.6541C50.7289 11.4063 45.9841 7.87449 39.7055 7.30176Z" fill="#E20813"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M31.7004 20.7605V20.665C32.4672 17.8968 32.3714 16.5605 32.2755 14.9854C32.2276 14.6036 32.2276 14.2218 32.2276 13.84C32.1797 11.9309 32.7548 10.1172 33.9051 8.6377C29.975 9.54452 26.9555 11.74 26.2845 14.4604L26.2366 14.5559L19.958 31.4991H29.6874L32.659 23.8627C32.1318 23.2423 31.4608 22.0968 31.7004 20.7605Z" fill="#124193"/>
              <path d="M67.5521 14.6045C66.8811 10.9294 64.5805 7.68397 60.938 5.20215C53.8446 0.33395 41.9584 -1.24106 30.0243 1.00213C18.1861 3.24532 7.83361 9.06807 2.99287 16.1795C0.452681 19.8545 -0.457951 23.7681 0.213043 27.4909C0.931965 31.1659 3.28044 34.4113 6.97091 36.8932C11.9554 40.2341 19.1446 42 27.0528 42C30.5036 42 34.1461 41.6659 37.7408 40.95C49.579 38.7068 59.9315 32.8841 64.7722 25.7727C67.3124 22.1454 68.271 18.2795 67.5521 14.6045ZM58.1102 27.1568C56.3848 29.6863 53.9884 31.9772 51.1606 33.8863C47.2785 36.4636 42.5815 38.4204 37.4532 39.375C34.9609 39.8523 32.4687 40.0909 30.1202 40.0909C27.7238 40.0909 25.4232 39.8523 23.2665 39.4227C18.4257 38.4682 14.3039 36.4636 11.3803 33.6954C10.2779 32.6454 9.31939 31.5 8.60046 30.259C8.55254 30.1636 8.50461 30.0681 8.45668 30.0204C8.40875 29.925 8.36082 29.8772 8.3129 29.7818C7.73776 28.684 7.25848 27.4909 7.01883 26.2022C6.49163 23.434 6.82712 20.5704 8.07326 17.8022C8.50461 16.7999 9.03182 15.8454 9.70281 14.8908C11.1886 12.7431 13.1536 10.7385 15.5021 9.02034C15.7418 8.87716 15.9335 8.68625 16.1731 8.54307C16.3648 8.39989 16.5086 8.30443 16.7003 8.16125C16.8441 8.06579 16.9879 7.97034 17.1317 7.87488C20.918 5.44078 25.4712 3.67487 30.4078 2.72032C35.3444 1.76577 40.2809 1.76577 44.6903 2.67259C48.237 3.3885 51.4482 4.62942 54.1322 6.44306C55.0428 7.06352 55.8576 7.7317 56.6244 8.44761C56.6724 8.49534 56.7203 8.54307 56.7682 8.59079C56.8641 8.68625 56.9599 8.82943 57.1037 8.92489C57.2475 9.06807 57.3913 9.21125 57.5351 9.35443C59.2126 11.2635 60.3628 13.5067 60.7942 15.8931C61.3214 18.6136 60.9859 21.4295 59.7877 24.1499C59.5481 24.6749 59.3084 25.1522 59.0688 25.6295C58.9729 25.7727 58.8771 25.9636 58.7812 26.1068C58.6854 26.2499 58.5895 26.4409 58.4936 26.584C58.3019 26.8704 58.254 27.0136 58.1102 27.1568Z" fill="#E20813"/>
              <path d="M83.7993 8.54639H76.7539V32.2669H81.5946V23.3896H84.6141C90.701 23.3896 92.9057 19.0941 92.9057 15.9919C92.9536 14.4646 92.3785 8.54639 83.7993 8.54639ZM81.6426 12.2691H83.8473C86.675 12.2691 87.9212 13.8919 87.9212 15.8487C87.9212 17.6146 86.7709 19.6669 83.8473 19.6669H81.6426V12.2691Z" fill="white"/>
              <path d="M105.033 24.2489L103.93 27.733H103.786L102.78 24.392L99.5208 14.6556H94.4404L101.294 33.2216L100.911 34.2239C100.288 35.7989 99.2812 36.1807 97.6995 36.1807C96.9806 36.1807 96.4534 36.0375 95.9262 35.8466L95.5907 39.1875C96.4534 39.5216 97.3161 39.6648 98.2267 39.6648C103.211 39.6648 104.409 37.183 105.416 34.3671L112.893 14.6079H108.196L105.033 24.2489Z" fill="white"/>
              <path d="M124.157 29.2121C120.946 29.2121 119.029 26.7303 119.029 23.5326C119.029 20.0485 121.425 17.8053 124.492 17.8053C125.595 17.8053 126.505 17.9007 127.32 18.2826L127.656 14.9416C126.314 14.6075 124.924 14.4644 123.774 14.4644C117.543 14.4644 114.236 18.6644 114.236 23.3417C114.236 28.0189 117.112 32.6008 123.438 32.6008C125.403 32.6008 127.129 32.219 127.943 31.8849L127.704 28.544C126.505 28.9735 125.259 29.2121 124.157 29.2121Z" fill="white"/>
              <path d="M139.925 29.2121C136.665 29.2121 134.796 26.7303 134.796 23.5326C134.796 20.0485 137.145 17.8053 140.26 17.8053C141.362 17.8053 142.225 17.9007 143.088 18.2826L143.423 14.9416C142.081 14.6075 140.596 14.4644 139.541 14.4644C133.31 14.4644 130.003 18.6644 130.003 23.3417C130.003 28.0189 132.879 32.6008 139.11 32.6008C141.123 32.6008 142.8 32.219 143.615 31.8849L143.471 28.544C142.273 28.9735 140.931 29.2121 139.925 29.2121Z" fill="white"/>
              <path d="M162.212 14.7026H157.084L151.381 22.7208H151.237V14.7026H146.636V32.2663H151.237V23.8663H151.381L157.324 32.2663H163.171L155.694 23.0072L162.212 14.7026Z" fill="white"/>
              <path d="M170.022 27.064L170.118 23.9618V14.7026H165.517V32.2663H170.406L178.218 19.9049H178.314L178.17 23.2458V32.2663H182.771V14.7026H177.595L170.022 27.064Z" fill="white"/>
              <path d="M164.416 13.653L164.463 13.606H164.416V13.653Z" fill="white"/>
              <path d="M199.307 14.7026L191.734 27.064H191.638L191.83 23.9618V14.7026H187.181V32.2663H192.118L199.93 19.9049H199.978L199.834 23.2458V32.2663H204.435V14.7026H199.307Z" fill="white"/>
              <path d="M196 11.6498C199.02 11.6498 200.745 9.8839 201.56 8.30889L199.93 6.73389C198.684 8.11798 197.102 8.35662 196.048 8.35662C194.898 8.35662 193.316 8.11798 192.07 6.73389L190.44 8.30889C191.255 9.8839 192.885 11.6498 196 11.6498Z" fill="white"/>
              <path d="M229.644 12.267C231.513 12.267 232.999 12.6011 234.389 13.1261L234.628 9.0693C232.855 8.5443 231.177 8.30566 229.308 8.30566C221.879 8.30566 216.128 12.3625 216.128 20.5716C216.128 29.1148 222.55 32.5512 228.445 32.5512C230.315 32.5512 232.519 32.2171 234.628 31.5489L234.293 27.4921C233.047 28.0171 231.417 28.4944 229.308 28.4944C224.995 28.4944 221.208 26.1557 221.208 20.4762C221.208 15.608 224.324 12.267 229.644 12.267Z" fill="white"/>
              <path d="M249.628 23.1012V22.9103C251.401 22.5762 252.839 21.1921 252.839 19.0444C252.839 17.183 251.881 14.7012 246.848 14.7012H238.173V32.2649H247.088C251.066 32.2649 253.654 30.499 253.654 27.3489C253.606 24.3898 251.593 23.2444 249.628 23.1012ZM245.65 21.6217H242.822V17.8035H245.65C246.513 17.8035 248.286 17.8989 248.286 19.6648C248.286 21.5262 246.561 21.6217 245.65 21.6217ZM242.822 24.6285H245.698C246.8 24.6285 248.813 24.7239 248.813 26.8717C248.813 29.2103 246.561 29.2103 245.698 29.2103H242.822V24.6285Z" fill="white"/>
              <path d="M273.114 23.8632C273.114 22.2882 273.018 14.4609 265.062 14.4609C260.317 14.4609 256.339 17.8973 256.339 23.4814C256.339 29.686 260.557 32.5496 265.877 32.5496C267.89 32.5496 270.094 32.1678 271.868 31.4519V27.9678C270.238 28.7314 268.417 29.2087 266.404 29.2087C262.905 29.2087 261.323 27.1087 261.18 24.8655H273.114V23.8632ZM264.774 17.6587C266.5 17.6587 268.513 18.8041 268.465 21.7632H261.228C261.18 19.4246 262.713 17.6587 264.774 17.6587Z" fill="white"/>
              <path d="M274.696 18.0864H280.208V32.2615H284.809V18.0864H290.273V14.6978H274.696V18.0864Z" fill="white"/>
              <path d="M300.769 7.11049C300.337 6.34685 299.762 5.77412 298.995 5.34458C298.228 4.91503 297.462 4.72412 296.647 4.72412C295.832 4.72412 295.065 4.91503 294.298 5.34458C293.531 5.77412 292.956 6.34685 292.525 7.11049C292.094 7.87413 291.902 8.63777 291.902 9.49686C291.902 10.3082 292.094 11.0719 292.525 11.8355C292.956 12.5991 293.531 13.1719 294.298 13.6014C295.065 14.031 295.832 14.2219 296.647 14.2219C297.462 14.2219 298.276 14.031 298.995 13.6014C299.762 13.1719 300.337 12.5991 300.769 11.8355C301.2 11.0719 301.392 10.3082 301.392 9.49686C301.44 8.63777 301.2 7.87413 300.769 7.11049ZM300.098 11.406C299.762 12.0264 299.283 12.5037 298.612 12.8855C297.989 13.2196 297.318 13.4105 296.647 13.4105C295.976 13.4105 295.305 13.2196 294.682 12.8855C294.059 12.5514 293.579 12.0741 293.196 11.406C292.86 10.7855 292.669 10.1173 292.669 9.44914C292.669 8.78095 292.86 8.11277 293.196 7.49231C293.531 6.87185 294.059 6.39458 294.682 6.01276C295.305 5.67867 295.976 5.48776 296.647 5.48776C297.318 5.48776 297.941 5.67867 298.612 6.01276C299.235 6.34685 299.762 6.82413 300.098 7.49231C300.433 8.11277 300.625 8.78095 300.625 9.44914C300.625 10.165 300.481 10.7855 300.098 11.406Z" fill="white"/>
              <path d="M297.509 10.0696C297.413 9.97411 297.269 9.87866 297.078 9.7832C297.509 9.73548 297.893 9.59229 298.132 9.30593C298.42 9.01957 298.516 8.68547 298.516 8.35138C298.516 8.11274 298.42 7.82638 298.276 7.58774C298.132 7.34911 297.893 7.20592 297.653 7.11047C297.365 7.01501 296.934 6.96729 296.359 6.96729H294.585V12.0741H295.4V9.92639H295.88C296.167 9.92639 296.407 9.97411 296.551 10.1173C296.79 10.2605 297.078 10.69 297.413 11.3105L297.845 12.1218H298.851L298.228 11.1196C297.988 10.5946 297.701 10.2605 297.509 10.0696ZM296.407 9.21048H295.4V7.6832H296.359C296.742 7.6832 297.03 7.73093 297.174 7.77865C297.317 7.82638 297.461 7.92184 297.509 8.06502C297.605 8.16047 297.653 8.30365 297.653 8.44683C297.653 8.68547 297.557 8.87638 297.413 9.01957C297.222 9.16275 296.886 9.21048 296.407 9.21048Z" fill="white"/>
            </svg>
          </div>
        </div>

        <div className="sidebar__search">
          <SidebarIcon name="search" size={13} />
          <input
            placeholder="Поиск задач, заявок…"
            value={sidebarQ}
            onChange={e => setSidebarQ(e.target.value)}
          />
          {sidebarQ ? (
            <button
              onClick={() => setSidebarQ('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--c-gray-400)', fontSize: 12 }}
            >
              <CloseOutlined />
            </button>
          ) : (
            <kbd>⌘K</kbd>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {filteredItems.map((it, i) => {
            if (it.section) {
              return (
                <div key={`s${i}`} className="sidebar__section-label">
                  {it.section}
                </div>
              );
            }
            const count = badgeCounts[it.id ?? ''] ?? undefined;
            const displayCount = count !== undefined && count > 0 ? count : undefined;
            return (
              <button
                key={it.id}
                className="sidebar__item"
                data-active={screen === it.id}
                onClick={() => it.id && onNav(it.id)}
              >
                <span className="sidebar__item-icon">
                  <SidebarIcon name={it.icon ?? 'list'} size={16} />
                </span>
                <span className="sidebar__item-label">{it.label}</span>
                {displayCount !== undefined && (
                  <span
                    className={`sidebar__item-count${it.accent ? ' sidebar__item-count--accent' : ''}`}
                  >
                    {displayCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <UserAvatar userId={userId} name={currentUser?.name} color={currentUser?.color} size="md" bordered={false} />
            <div className="sidebar__user-meta">
              <div className="sidebar__user-name">{userName}</div>
              <div className="sidebar__user-role">{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="sidebar__logout-btn"
          >
            <SidebarIcon name="logout" size={14} />
            <span className="sidebar__logout-label">
              {isLoggingOut ? 'Выход…' : 'Выйти'}
            </span>
          </button>
        </div>
      </aside>

      {}
      <div className="main">
        {}
        <div className="topbar">
          <div className="crumbs">
            <SidebarIcon name="home" size={14} />
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <span className="crumbs__sep">/</span>
                {i === crumbs.length - 1 ? (
                  <span className="crumbs__current">{c}</span>
                ) : (
                  <span>{c}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="topbar__search">
            <SidebarIcon name="search" size={14} />
            <input
              placeholder="Глобальный поиск (задачи, заявки, пользователи)…"
              value={topbarQ}
              onChange={e => setTopbarQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && topbarQ.trim()) {
                  setScreen(searchTarget, { q: topbarQ.trim() });
                  setTopbarQ('');
                }
              }}
            />
          </div>
          <div className="topbar__actions">
            {onCreate && (
              <button className="btn btn--primary btn--sm" onClick={onCreate}>
                <SidebarIcon name="plus" size={14} /> Создать
              </button>
            )}
            <button className="iconbtn" onClick={() => onNav('notifications')} title="Уведомления">
              <SidebarIcon name="bell" size={18} />
              {notifications.filter(n => !n.read).length > 0 && <span className="iconbtn__dot" />}
            </button>
          </div>
        </div>

        <div className="content">{children}</div>
      </div>
    </div>
  );
};
