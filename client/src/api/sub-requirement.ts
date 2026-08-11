import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  SubRequirementListResponse,
  SubRequirementItem,
  CreateSubRequirementDto,
  UpdateSubRequirementDto,
} from '@shared/api.interface';

export interface SubRequirementListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  appStatus?: string;
  appPriority?: string;
}

export async function getSubRequirementList(
  params: SubRequirementListParams = {},
): Promise<SubRequirementListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  try {
    const response = await axiosForBackend({
      url: `/api/sub-requirements?${query.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取子需求列表失败', error);
    throw error;
  }
}

export async function getSubRequirementDetail(id: string): Promise<SubRequirementItem> {
  try {
    const response = await axiosForBackend({
      url: `/api/sub-requirements/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取子需求详情失败', error);
    throw error;
  }
}

export async function createSubRequirement(
  dto: CreateSubRequirementDto,
): Promise<SubRequirementItem> {
  try {
    const response = await axiosForBackend({
      url: '/api/sub-requirements',
      method: 'POST',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('创建子需求失败', error);
    throw error;
  }
}

export async function updateSubRequirement(
  id: string,
  dto: UpdateSubRequirementDto,
): Promise<SubRequirementItem> {
  try {
    const response = await axiosForBackend({
      url: `/api/sub-requirements/${id}`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('更新子需求失败', error);
    throw error;
  }
}

export async function deleteSubRequirement(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/sub-requirements/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除子需求失败', error);
    throw error;
  }
}