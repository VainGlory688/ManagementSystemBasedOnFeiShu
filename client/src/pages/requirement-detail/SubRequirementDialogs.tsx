import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createSubRequirement,
  deleteSubRequirement,
  getSubRequirementDetail,
  updateSubRequirement,
} from '@/api/sub-requirement';
import { UserSelect } from '@/components/business-ui/user-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import type { CreateSubRequirementDto, SubRequirementItem, UpdateSubRequirementDto } from '@shared/api.interface';

const formSchema = z.object({
  appSubRequirementName: z.string().trim().min(1, '子需求名称不能为空'),
  appStatus: z.string().optional(),
  appCurrentOwner: z.string().optional().nullable(),
  appExpectedStartDate: z.string().optional(),
  appExpectedEndDate: z.string().optional(),
  appOverdueDays: z.coerce.number().int().min(0, '逾期天数不能小于 0').optional(),
  appPriority: z.string().optional(),
  appDetails: z.string().optional(),
});

type SubRequirementFormData = z.infer<typeof formSchema>;

const emptyValues: SubRequirementFormData = {
  appSubRequirementName: '',
  appStatus: '',
  appCurrentOwner: null,
  appExpectedStartDate: '',
  appExpectedEndDate: '',
  appOverdueDays: 0,
  appPriority: '',
  appDetails: '',
};

interface SubRequirementDialogsProps {
  parentRequirementId: string;
  editorOpen: boolean;
  editingItem: SubRequirementItem | null;
  deletingItem: SubRequirementItem | null;
  onCloseEditor: () => void;
  onCloseDelete: () => void;
  onSaved: () => void;
}

const SubRequirementDialogs = ({
  parentRequirementId,
  editorOpen,
  editingItem,
  deletingItem,
  onCloseEditor,
  onCloseDelete,
  onSaved,
}: SubRequirementDialogsProps) => {
  const { options } = useFieldOptions();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const form = useForm<SubRequirementFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!editingItem) {
      form.reset(emptyValues);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    getSubRequirementDetail(editingItem.id)
      .then((item) => {
        if (!cancelled) {
          form.reset({
            appSubRequirementName: item.appSubRequirementName,
            appStatus: item.appStatus,
            appCurrentOwner: item.appCurrentOwner || null,
            appExpectedStartDate: item.appExpectedStartDate,
            appExpectedEndDate: item.appExpectedEndDate,
            appOverdueDays: item.appOverdueDays,
            appPriority: item.appPriority,
            appDetails: item.appDetails || '',
          });
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('加载子需求详情失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingItem, form]);

  const closeEditor = () => {
    form.reset(emptyValues);
    onCloseEditor();
  };

  const handleSave = async (data: SubRequirementFormData) => {
    const dto = {
      ...data,
      appCurrentOwner: data.appCurrentOwner || undefined,
      appOverdueDays: data.appOverdueDays || 0,
    };

    try {
      if (editingItem) {
        await updateSubRequirement(editingItem.id, dto as UpdateSubRequirementDto);
        toast.success('子需求已更新');
      } else {
        await createSubRequirement({
          ...dto,
          appParentWorkItem: parentRequirementId,
        } as CreateSubRequirementDto);
        toast.success('子需求已创建');
      }
      closeEditor();
      onSaved();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || (editingItem ? '更新子需求失败' : '创建子需求失败'));
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteSubRequirement(deletingItem.id);
      toast.success('子需求已删除');
      onCloseDelete();
      onSaved();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || '删除子需求失败');
    }
  };

  const statusOptions = options.sub_req_status || [];
  const priorityOptions = options.sub_req_priority || [];

  return (
    <>
      <Dialog open={editorOpen && editingItem !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>编辑子需求</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : (
            <SubRequirementForm
              form={form}
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              submitLabel="保存"
              onSubmit={handleSave}
              onCancel={closeEditor}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen && editingItem === null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>新建子需求</DialogTitle>
          </DialogHeader>
          <SubRequirementForm
            form={form}
            statusOptions={statusOptions}
            priorityOptions={priorityOptions}
            submitLabel="创建"
            onSubmit={handleSave}
            onCancel={onCloseEditor}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deletingItem !== null} onOpenChange={(open) => !open && onCloseDelete()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除子需求「{deletingItem?.appSubRequirementName}」吗？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCloseDelete}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface SubRequirementFormProps {
  form: ReturnType<typeof useForm<SubRequirementFormData>>;
  statusOptions: string[];
  priorityOptions: string[];
  submitLabel: string;
  onSubmit: (data: SubRequirementFormData) => void;
  onCancel: () => void;
}

function SubRequirementForm({
  form,
  statusOptions,
  priorityOptions,
  submitLabel,
  onSubmit,
  onCancel,
}: SubRequirementFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="appSubRequirementName" render={({ field }) => (
          <FormItem>
            <FormLabel>子需求名称 <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input placeholder="请输入子需求名称" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="appStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>状态</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                <SelectContent>{statusOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="appPriority" render={({ field }) => (
            <FormItem>
              <FormLabel>优先级</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                <SelectContent>{priorityOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="appCurrentOwner" render={({ field }) => (
          <FormItem>
            <FormLabel>当前负责人</FormLabel>
            <FormControl><UserSelect value={field.value} onChange={field.onChange} triggerType="search" placeholder="请选择负责人" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="appExpectedStartDate" render={({ field }) => (
            <FormItem><FormLabel>预计开始</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="appExpectedEndDate" render={({ field }) => (
            <FormItem><FormLabel>预计结束</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="appOverdueDays" render={({ field }) => (
          <FormItem><FormLabel>逾期天数</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="appDetails" render={({ field }) => (
          <FormItem><FormLabel>详情描述</FormLabel><FormControl><Textarea className="resize-none" rows={4} placeholder="请输入子需求详情" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}

export default SubRequirementDialogs;
