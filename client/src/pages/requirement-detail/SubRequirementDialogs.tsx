import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createSubRequirement,
  deleteSubRequirement,
  getSubRequirementList,
  getSubRequirementDetail,
  updateSubRequirement,
} from '@/api/sub-requirement';
import { getRequirementDetail } from '@/api/requirement';
import { isOptimisticLockConflict } from '../../api/request-error';
import { UserSelect } from '@/components/business-ui/user-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import type { CreateSubRequirementDto, SubRequirementItem, UpdateSubRequirementDto } from '@shared/api.interface';
import { getIncompletePipelinePredecessorIds } from '../../../../shared/requirement-business-rules';

const formSchema = z.object({
  appSubRequirementName: z.string().trim().min(1, '子需求名称不能为空'),
  appStatus: z.string().optional(),
  appCurrentOwner: z.string().optional().nullable(),
  appExpectedStartDate: z.string().optional(),
  appExpectedEndDate: z.string().optional(),
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
  appPriority: '',
  appDetails: '',
};

const toDateInputValue = (value?: string) => value ? value.slice(0, 10) : '';

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
  const [completionBlockers, setCompletionBlockers] = useState<string[]>([]);
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
            appExpectedStartDate: toDateInputValue(item.appExpectedStartDate),
            appExpectedEndDate: toDateInputValue(item.appExpectedEndDate),
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
    };

    if (
      editingItem
      && ['已完成', '已上线'].includes(data.appStatus || '')
      && !['已完成', '已上线'].includes(editingItem.appStatus)
    ) {
      try {
        const [requirement, subRequirements] = await Promise.all([
          getRequirementDetail(parentRequirementId),
          getSubRequirementList({ page: 1, pageSize: 1000 }),
        ]);
        const siblings = subRequirements.items.filter((item) =>
          item.appParentWorkItemRecordId === parentRequirementId
          || item.appParentWorkItemRecordId === requirement.baseRecordId
          || item.appParentWorkItemRecordId === requirement.id,
        );
        const blockerIds = getIncompletePipelinePredecessorIds(
          editingItem.baseRecordId || editingItem.id,
          siblings.map((item) => ({ id: item.baseRecordId || item.id, status: item.appStatus })),
          requirement.pipeline?.edges || [],
        );
        if (blockerIds.length > 0) {
          const nameById = new Map(siblings.map((item) => [
            item.baseRecordId || item.id,
            item.appSubRequirementName,
          ]));
          setCompletionBlockers(blockerIds.map((blockerId) =>
            nameById.get(blockerId) || '未命名前置子需求'));
          return;
        }
      } catch {
        toast.error('无法校验前置子需求状态，请稍后重试');
        return;
      }
    }

    try {
      if (editingItem) {
        await updateSubRequirement(editingItem.id, {
          ...dto,
          expectedUpdatedAt: editingItem.updatedAt,
        } as UpdateSubRequirementDto);
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
      if (isOptimisticLockConflict(error)) {
        toast.error('已被其他人修改，请刷新后重试');
        closeEditor();
        onSaved();
        return;
      }
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
      <Dialog open={completionBlockers.length > 0} onOpenChange={(open) => !open && setCompletionBlockers([])}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>无法完成子需求</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            请先完成以下前置子需求，再将当前节点标记为已完成：
          </p>
          <ul className="space-y-1 rounded-sm border border-severity-fatal/30 bg-severity-fatal-bg p-3 text-sm text-severity-fatal">
            {completionBlockers.map((name) => <li key={name}>• {name}</li>)}
          </ul>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setCompletionBlockers([])}>我知道了</Button>
          </div>
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
        <FormField control={form.control} name="appDetails" render={({ field }) => (
          <FormItem><FormLabel>详情描述</FormLabel><FormControl><Textarea className="resize-none" rows={4} placeholder="请输入子需求详情" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '提交中…' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default SubRequirementDialogs;
