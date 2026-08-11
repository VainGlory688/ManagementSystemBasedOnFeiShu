import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  TestPlanListResponse,
  TestPlan,
  CreateTestPlanDto,
  UpdateTestPlanDto,
} from '@shared/api.interface';

export interface TestPlanListParams {
  page?: number;
  pageSize?: number;
  testStatus?: string;
  priority?: string;
  testPlanType?: string;
  businessLine?: string;
  planningVersion?: string;
  executor?: string;
  keyword?: string;
}

export async function getTestPlanList(params: TestPlanListParams = {}): Promise<TestPlanListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  try {
    const response = await axiosForBackend({
      url: `/api/test-plans?${query.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取测试计划列表失败', error);
    throw error;
  }
}

export async function getTestPlanDetail(id: string): Promise<TestPlan> {
  try {
    const response = await axiosForBackend({
      url: `/api/test-plans/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取测试计划详情失败', error);
    throw error;
  }
}

export async function createTestPlan(dto: CreateTestPlanDto): Promise<TestPlan> {
  try {
    const response = await axiosForBackend({
      url: '/api/test-plans',
      method: 'POST',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('创建测试计划失败', error);
    throw error;
  }
}

export async function updateTestPlan(id: string, dto: UpdateTestPlanDto): Promise<TestPlan> {
  try {
    const response = await axiosForBackend({
      url: `/api/test-plans/${id}`,
      method: 'PUT',
      data: dto,
    });
    return response.data;
  } catch (error) {
    logger.error('更新测试计划失败', error);
    throw error;
  }
}

export async function deleteTestPlan(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/test-plans/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除测试计划失败', error);
    throw error;
  }
}
