import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface RowActionsProps {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RowActions({ label, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onEdit}
          aria-label={`编辑${label}`}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`删除${label}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
