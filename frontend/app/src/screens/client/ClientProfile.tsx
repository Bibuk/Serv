import React, { useState } from 'react';
import { LockOutlined } from '@ant-design/icons';
import { ruDate } from '../../utils/helpers';
import { useAppStore } from '../../store/appStore';
import { updateProfile, changePassword } from '../../api';

const ProfileAvatar: React.FC<{ avatar: string; color: string }> = ({ avatar, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 999, background: color, color: '#fff', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
    {avatar}
  </span>
);

interface Props {
  mobile: boolean;
}

const Switch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    style={{
      width: 32,
      height: 18,
      borderRadius: 999,
      background: on ? 'var(--c-blue-500)' : 'var(--c-gray-300)',
      position: 'relative',
      flexShrink: 0,
      display: 'inline-block',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: on ? 16 : 2,
        width: 14,
        height: 14,
        borderRadius: 999,
        background: '#fff',
        transition: 'left 150ms',
      }}
    />
  </span>
);

interface NotifSetting {
  label: string;
  sub: string;
  on: boolean;
}

export const ClientProfile: React.FC<Props> = ({ mobile }) => {
  const { setToast, currentUser } = useAppStore();
  const userId = currentUser?.id ?? '';

  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [phone, setPhone] = useState('');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  const notifyOn = currentUser?.notifyEmail ?? true;
  const [notifSettings, setNotifSettings] = useState<NotifSetting[]>([
    { label: 'Смена статуса заявки', sub: 'Получать уведомления при изменении статуса', on: notifyOn },
    { label: 'Новые комментарии', sub: 'Уведомлять о новых сообщениях от специалистов', on: notifyOn },
    { label: 'Решение принято', sub: 'Уведомлять при закрытии заявки', on: notifyOn },
    { label: 'Маркетинговые письма', sub: 'Новости и обновления сервиса', on: false },
  ]);
  const [notifSaving, setNotifSaving] = useState(false);

  const toggleNotif = (i: number) => {
    setNotifSettings(prev => prev.map((s, idx) => idx === i ? { ...s, on: !s.on } : s));
  };

  const handleSaveNotif = async () => {
    setNotifSaving(true);
    try {
      await updateProfile(userId, { notifyEmail: notifSettings.some(s => s.on) });
      setToast({ kind: 'success', msg: 'Настройки уведомлений сохранены' });
    } catch {
      setToast({ kind: 'error', msg: 'Не удалось сохранить настройки' });
    } finally {
      setNotifSaving(false);
    }
  };

  const validateProfile = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 100) {
      errors.name = 'Введите имя';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.email = 'Введите корректный email';
    }
    if (phone && !/^\+?[\d\s\-()]{7,}$/.test(phone)) {
      errors.phone = 'Введите корректный телефон';
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    setProfileSaving(true);
    try {
      await updateProfile(userId, { name, email, phone });
      setToast({ kind: 'success', msg: 'Профиль успешно обновлён' });
    } catch {
      setToast({ kind: 'error', msg: 'Не удалось сохранить профиль' });
    } finally {
      setProfileSaving(false);
    }
  };

  const validatePassword = (): boolean => {
    const errors: Record<string, string> = {};
    if (!currentPassword) {
      errors.currentPassword = 'Введите текущий пароль';
    }
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if (newPassword.length < 8 || !hasLetter || !hasDigit) {
      errors.newPassword = 'Минимум 8 символов, буквы и цифры';
    }
    if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;
    setPwdSaving(true);
    try {
      await changePassword(userId, { currentPassword, newPassword });
      setToast({ kind: 'success', msg: 'Пароль успешно изменён' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch {
      setToast({ kind: 'error', msg: 'Не удалось изменить пароль' });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div style={{ padding: mobile ? 16 : '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {}
      <div>
        <h1 style={{ margin: 0, fontSize: mobile ? 20 : 24, fontWeight: 700, color: 'var(--c-gray-900)' }}>Профиль</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--c-gray-500)' }}>Управление личными данными и настройками</p>
      </div>

      {}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <ProfileAvatar avatar={currentUser?.avatar ?? '?'} color={currentUser?.color ?? '#9CA3AF'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-gray-900)' }}>{currentUser?.name ?? name}</div>
            <div style={{ fontSize: 13, color: 'var(--c-gray-500)', marginTop: 2 }}>{email || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--c-gray-400)', marginTop: 2 }}>
              {currentUser?.role === 'client' ? 'Клиент' : 'Сотрудник'} с {ruDate('2026-01-15')}
            </div>
          </div>
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {}
        <div className="card">
          <div className="card__head">
            <span className="card__title">Личные данные</span>
          </div>
          <div className="card__body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Имя</label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {profileErrors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{profileErrors.name}</div>}
            </div>

            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {profileErrors.email && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{profileErrors.email}</div>}
            </div>

            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Телефон</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {profileErrors.phone && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{profileErrors.phone}</div>}
            </div>

            <button
              className="btn btn--primary"
              style={{ alignSelf: 'flex-start', opacity: profileSaving ? 0.6 : 1, cursor: profileSaving ? 'not-allowed' : 'pointer' }}
              onClick={handleSaveProfile}
              disabled={profileSaving}
            >
              {profileSaving ? 'Сохранение…' : 'Сохранить изменения'}
            </button>
          </div>
        </div>

        {}
        <div className="card">
          <div className="card__head">
            <span className="card__title">Уведомления</span>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            {notifSettings.map((setting, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
                onClick={() => toggleNotif(i)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-900)' }}>{setting.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-gray-500)', marginTop: 2 }}>{setting.sub}</div>
                </div>
                <Switch on={setting.on} />
              </div>
            ))}
            <div style={{ padding: '12px 20px' }}>
              <button
                className="btn btn--primary"
                style={{ opacity: notifSaving ? 0.6 : 1, cursor: notifSaving ? 'not-allowed' : 'pointer' }}
                onClick={handleSaveNotif}
                disabled={notifSaving}
              >
                {notifSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="card">
        <div
          className="card__head"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowPasswordForm(v => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockOutlined style={{ fontSize: 16 }} />
            <span className="card__title">Безопасность</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>Пароль, 2FA</span>
            <span style={{ color: 'var(--c-gray-400)', fontSize: 16 }}>{showPasswordForm ? '∨' : '›'}</span>
          </div>
        </div>
        {showPasswordForm && (
          <div className="card__body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Старый пароль</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Введите текущий пароль"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {pwdErrors.currentPassword && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{pwdErrors.currentPassword}</div>}
            </div>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Новый пароль</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {pwdErrors.newPassword && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{pwdErrors.newPassword}</div>}
            </div>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Подтверждение пароля</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg-surface)',
                  color: 'var(--c-gray-900)',
                }}
              />
              {pwdErrors.confirmPassword && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{pwdErrors.confirmPassword}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn--primary"
                onClick={handleChangePassword}
                disabled={pwdSaving}
                style={{ opacity: pwdSaving ? 0.6 : 1, cursor: pwdSaving ? 'not-allowed' : 'pointer' }}
              >
                {pwdSaving ? 'Сохранение…' : 'Сменить пароль'}
              </button>
              <button className="btn btn--outline" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
