import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DefectListResponse,
  DefectItem,
  CreateDefectDto,
  UpdateDefectDto,
} from '@shared/api.interface';

export interface DefectListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  severity?: string;
  priority?: string;
  businessLine?: string;
  discoveryEnvironment?: string;
  testingStage?: string;
  currentOwner?: string;
  keyword?: string;
}

export async function getDefectList(params: DefectListParams = {}): Promise<DefectListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  try {
    const response = await axiosForBackend({
      url: `/api/defects?${query.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取缺陷列表失败', error);
    throw error;
  }
}

export async function getDefectDetail(id: string): Promise<DefectItem> {
  try {
    const response = await axiosForBackend({
      url: `/api/defects/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取缺陷详情失败', error);
    throw error;
  }
}

export async function createDefect(dto: CreateDefectDto): Promise<DefectItem> {
  try {
    const response = await axiosForBackend({
      url: '/api/defects',
      method: 'POST',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('创建缺陷失败', error);
    throw error;
  }
}

export async function updateDefect(id: string, dto: UpdateDefectDto): Promise<DefectItem> {
  try {
    const response = await axiosForBackend({
      url: `/api/defects/${id}`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('更新缺陷失败', error);
    throw error;
  }
}

export async function deleteDefect(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/defects/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除缺陷失败', error);
    throw error;
  }
}
