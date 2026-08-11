import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  RequirementListResponse,
  VersionRequirement,
  SubRequirementListResponse,
  CreateRequirementDto,
  UpdateRequirementDto,
  RequirementPipelineConfig,
  UpdateRequirementPipelineDto,
} from '@shared/api.interface';

export interface RequirementListParams {
  page?: number;
  pageSize?: number;
  businessLine?: string;
  priority?: string;
  reqType?: string;
  planningVersion?: string;
  currentOwner?: string;
  keyword?: string;
}

export async function getRequirementList(params: RequirementListParams = {}): Promise<RequirementListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  try {
    const response = await axiosForBackend({
      url: `/api/requirements?${query.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取需求列表失败', error);
    throw error;
  }
}

export async function getRequirementDetail(id: string): Promise<VersionRequirement> {
  try {
    const response = await axiosForBackend({
      url: `/api/requirements/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取需求详情失败', error);
    throw error;
  }
}

export async function getSubRequirementList(
  id: string,
  page = 1,
  pageSize = 20,
): Promise<SubRequirementListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/requirements/${id}/sub-items?page=${page}&pageSize=${pageSize}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取子需求列表失败', error);
    throw error;
  }
}

export async function createRequirement(dto: CreateRequirementDto): Promise<VersionRequirement> {
  try {
    const response = await axiosForBackend({
      url: '/api/requirements',
      method: 'POST',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('创建需求失败', error);
    throw error;
  }
}

export async function updateRequirement(id: string, dto: UpdateRequirementDto): Promise<VersionRequirement> {
  try {
    const response = await axiosForBackend({
      url: `/api/requirements/${id}`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('更新需求失败', error);
    throw error;
  }
}

export async function updateRequirementPipeline(
  id: string,
  dto: UpdateRequirementPipelineDto,
): Promise<RequirementPipelineConfig> {
  try {
    const response = await axiosForBackend({
      url: `/api/requirements/${id}/pipeline`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('保存需求流水线失败', error);
    throw error;
  }
}

export async function deleteRequirement(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/requirements/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除需求失败', error);
    throw error;
  }
}
