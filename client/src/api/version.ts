import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  VersionListResponse,
  MainVersion,
  RequirementListResponse,
  VersionSummary,
  CreateVersionDto,
  UpdateVersionDto,
} from '@shared/api.interface';

export interface VersionListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  businessLine?: string;
  versionType?: string;
  priority?: string;
  keyword?: string;
}

export async function getVersionList(params: VersionListParams = {}): Promise<VersionListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  try {
    const response = await axiosForBackend({
      url: `/api/versions?${query.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取版本列表失败', error);
    throw error;
  }
}

export async function getVersionDetail(id: string): Promise<MainVersion> {
  try {
    const response = await axiosForBackend({
      url: `/api/versions/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取版本详情失败', error);
    throw error;
  }
}

export async function getVersionRequirements(
  id: string,
  page = 1,
  pageSize = 20,
): Promise<RequirementListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/versions/${id}/requirements?page=${page}&pageSize=${pageSize}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取版本关联需求失败', error);
    throw error;
  }
}

export async function getVersionSummary(id: string): Promise<VersionSummary> {
  try {
    const response = await axiosForBackend({
      url: `/api/versions/${id}/summary`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取版本数据概览失败', error);
    throw error;
  }
}

export async function createVersion(dto: CreateVersionDto): Promise<MainVersion> {
  try {
    const response = await axiosForBackend({
      url: '/api/versions',
      method: 'POST',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('创建版本失败', error);
    throw error;
  }
}

export async function updateVersion(id: string, dto: UpdateVersionDto): Promise<MainVersion> {
  try {
    const response = await axiosForBackend({
      url: `/api/versions/${id}`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('更新版本失败', error);
    throw error;
  }
}

export async function deleteVersion(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/versions/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除版本失败', error);
    throw error;
  }
}
