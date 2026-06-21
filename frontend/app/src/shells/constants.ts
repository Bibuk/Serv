// Shared shell constants. Kept out of the *Shell component files so those
// modules export only components (required for React Fast Refresh).

export const ROLE_LABEL: Record<string, string> = {
  manager:  'Менеджер',
  teamlead: 'Тимлид',
  worker:   'Работник',
  admin:    'Администратор',
  client:   'Клиент',
};

export const CURRENT_USER_BY_ROLE: Record<string, string> = {
  manager:  'u1',
  teamlead: 'u2',
  worker:   'u4',
  admin:    'u11',
  client:   'u12',
};

export const CLIENT_NAV = [
  { id: 'tickets',     label: 'Мои заявки' },
  { id: 'tickets-new', label: 'Создать заявку' },
  { id: 'profile',     label: 'Профиль' },
];
