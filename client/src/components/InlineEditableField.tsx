import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface InlineEditableFieldProps<T> {
  value: T;
  children: React.ReactNode;
  renderEditor: (value: T, onChange: (value: T) => void) => React.ReactNode;
  onSave: (value: T) => Promise<void>;
  className?: string;
}

export function InlineEditableField<T>({
  value,
  children,
  renderEditor,
  onSave,
  className,
}: InlineEditableFieldProps<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
        <div className="min-w-0 flex-1">{renderEditor(draft, setDraft)}</div>
        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={saving} onClick={save} aria-label="保存">
          <Check className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={saving} onClick={cancel} aria-label="取消">
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group/field flex min-h-7 items-center gap-1 ${className || ''}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 opacity-0 transition-opacity group-hover/field:opacity-100 focus:opacity-100"
        onClick={() => setEditing(true)}
        aria-label="编辑字段"
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
