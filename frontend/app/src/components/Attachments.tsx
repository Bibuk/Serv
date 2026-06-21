import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarIcon } from '../shells/SidebarIcon';
import { useAppStore } from '../store/appStore';
import {
  getTaskFiles, uploadTaskFile, deleteTaskFile,
  getSubtaskFiles, uploadSubtaskFile, deleteSubtaskFile,
} from '../api';
import type { FileAttachment } from '../api';

type OwnerKind = 'task' | 'subtask';

interface AttachmentsProps {
  kind: OwnerKind;
  id: string;
  canDelete?: boolean;
  canUpload?: boolean;
  // Collapsible header (used in dense subtask lists); otherwise always open.
  collapsible?: boolean;
  defaultOpen?: boolean;
  // Denser styling for inline subtask rows.
  compact?: boolean;
  title?: string;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

// A single React Query key per owner so every place that renders the same
// task/subtask shares one cache entry — uploads and deletes propagate live.
const filesKey = (kind: OwnerKind, id: string) => ['attachments', kind, id];

const api = {
  task:    { list: getTaskFiles,    upload: uploadTaskFile,    remove: deleteTaskFile,    base: 'tasks' },
  subtask: { list: getSubtaskFiles, upload: uploadSubtaskFile, remove: deleteSubtaskFile, base: 'subtasks' },
} as const;

export const Attachments: React.FC<AttachmentsProps> = ({
  kind, id, canDelete = false, canUpload = true,
  collapsible = false, defaultOpen = false, compact = false, title = 'Вложения',
}) => {
  const qc = useQueryClient();
  const setToast = useAppStore(s => s.setToast);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(!collapsible || defaultOpen);

  const a = api[kind];
  const key = filesKey(kind, id);

  const filesQ = useQuery<FileAttachment[]>({
    queryKey: key,
    queryFn: () => a.list(id),
    enabled: open,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const uploadM = useMutation({
    mutationFn: (file: File) => a.upload(id, file),
    onSuccess: () => { invalidate(); setToast({ kind: 'success', msg: 'Файл загружен' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Ошибка загрузки' }),
  });

  const deleteM = useMutation({
    mutationFn: (fileId: string) => a.remove(id, fileId),
    onSuccess: () => { invalidate(); setToast({ kind: 'success', msg: 'Файл удалён' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Ошибка удаления' }),
  });

  const files = filesQ.data ?? [];
  const fs = compact ? 11 : 13;
  const iconSize = compact ? 11 : 14;

  const list = (
    <div style={{ marginTop: collapsible ? 8 : 0, display: 'flex', flexDirection: 'column', gap: compact ? 5 : 6 }}>
      {filesQ.isLoading ? (
        <span style={{ fontSize: fs, color: 'var(--c-gray-400)' }}>Загрузка…</span>
      ) : files.length === 0 ? (
        compact
          ? <span style={{ fontSize: fs, color: 'var(--c-gray-400)' }}>Нет вложений</span>
          : <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>Файлов пока нет
            </div>
      ) : files.map(f => (
        <div
          key={f.id}
          style={compact
            ? { display: 'flex', alignItems: 'center', gap: 6 }
            : { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff' }}
        >
          <SidebarIcon name="fileText" size={iconSize} />
          <a
            href={`/api/${a.base}/${id}/files/${f.id}/download`}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, fontSize: fs, color: 'var(--c-blue-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
            title={f.filename}
          >
            {f.filename}
          </a>
          <span style={{ fontSize: compact ? 10 : 11, color: 'var(--c-gray-400)', flexShrink: 0 }}>{formatSize(f.sizeBytes)}</span>
          {canDelete && (
            <button
              className="iconbtn"
              style={{ color: 'var(--c-gray-400)', padding: 2, flexShrink: 0 }}
              disabled={deleteM.isPending}
              onClick={() => deleteM.mutate(f.id)}
              title="Удалить файл"
            >
              <SidebarIcon name="x" size={compact ? 11 : 13} />
            </button>
          )}
        </div>
      ))}
      {canUpload && (
        <div style={{ marginTop: compact ? 2 : 8 }}>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { uploadM.mutate(f); e.target.value = ''; }
            }}
          />
          <button
            className={compact ? 'btn btn--ghost btn--sm' : 'btn btn--outline btn--sm'}
            style={compact ? { fontSize: 11, padding: '3px 8px', gap: 4 } : { gap: 6 }}
            disabled={uploadM.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <SidebarIcon name="upload" size={compact ? 11 : 13} />
            {uploadM.isPending ? 'Загрузка…' : 'Прикрепить файл'}
          </button>
        </div>
      )}
    </div>
  );

  if (!collapsible) return list;

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <SidebarIcon name="paperclip" size={12} />
        <span style={{ fontSize: 12, color: 'var(--c-gray-500)', flex: 1 }}>
          {title}{files.length > 0 ? ` (${files.length})` : ''}
        </span>
        <SidebarIcon name={open ? 'chevronUp' : 'chevronDown'} size={11} />
      </div>
      {open && list}
    </div>
  );
};
