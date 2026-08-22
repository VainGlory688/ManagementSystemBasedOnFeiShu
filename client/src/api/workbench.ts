import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  WorkbenchOverview,
  MyRequirementListResponse,
  MyDefectListResponse,
  MyTestPlanListResponse,
  MyVersionListResponse,
  MyBlockedSubRequirementListResponse,
} from '@shared/api.interface';

export async function getWorkbenchOverview(): Promise<WorkbenchOverview> {
  try {
    const response = await axiosForBackend({
      url: '/api/workbench/overview',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取工作台概览失败', error);
    throw error;
  }
}

export async function getMyRequirements(
  page = 1,
  pageSize = 10,
  sort?: 'priority',
  status?: string,
): Promise<MyRequirementListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/workbench/my-requirements?page=${page}&pageSize=${pageSize}${sort ? `&sort=${sort}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的需求失败', error);
    throw error;
  }
}

export async function getMyDefects(
  page = 1,
  pageSize = 10,
  sort?: 'priority',
  status?: string,
): Promise<MyDefectListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/workbench/my-defects?page=${page}&pageSize=${pageSize}${sort ? `&sort=${sort}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的缺陷失败', error);
    throw error;
  }
}

export async function getMyTestPlans(
  page = 1,
  pageSize = 10,
): Promise<MyTestPlanListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/workbench/my-test-plans?page=${page}&pageSize=${pageSize}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的测试计划失败', error);
    throw error;
  }
}

export async function getMyVersions(
  page = 1,
  pageSize = 10,
  sort?: 'name',
): Promise<MyVersionListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/workbench/my-versions?page=${page}&pageSize=${pageSize}${sort ? `&sort=${sort}` : ''}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的版本失败', error);
    throw error;
  }
}

export async function getMyBlockedSubRequirements(
  page = 1,
  pageSize = 10,
): Promise<MyBlockedSubRequirementListResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/workbench/my-blocked-sub-requirements?page=${page}&pageSize=${pageSize}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取我被阻塞的子需求失败', error);
    throw error;
  }
}
