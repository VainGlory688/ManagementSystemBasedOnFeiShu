import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface FieldOptions {
  field: string;
  values: string[];
}

export async function getAllOptions(): Promise<Record<string, string[]>> {
  const response = await axiosForBackend({ url: '/api/options', method: 'GET' });
  if (response.status === 403) throw new Error('无操作权限，请联系管理员分配角色');
  return response.data;
}

export async function getDistinctOption(field: string): Promise<FieldOptions> {
  const response = await axiosForBackend({ url: `/api/options/${field}`, method: 'GET' });
  if (response.status === 403) throw new Error('无操作权限，请联系管理员分配角色');
  return response.data;
}