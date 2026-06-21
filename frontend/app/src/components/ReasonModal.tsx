import React, { useState } from 'react';

interface Props {
  title: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export const ReasonModal: React.FC<Props> = ({
  title, label = 'Причина', placeholder, confirmLabel = 'Подтвердить', busy, onConfirm, onClose,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();

  const submit = () => {
    setTouched(true);
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, width: 420, padding: 24, boxShadow: 'var(--sh-xl)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--c-gray-900)' }}>{title}</div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>{label}</label>
        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '8px 12px', border: `1px solid ${touched && !trimmed ? '#DC2626' : 'var(--border-subtle)'}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
        />
        {touched && !trimmed && (
          <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>Укажите причину</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn--outline btn--sm" onClick={onClose} disabled={busy}>Отмена</button>
          <button
            className="btn btn--sm"
            style={{ background: '#DC2626', color: '#fff', border: 'none', opacity: busy ? 0.6 : 1 }}
            onClick={submit}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
