import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DashboardKpis,
  DefectSeverityResponse,
  BusinessLineStatsResponse,
  VersionStatusResponse,
  RecentActivitiesResponse,
} from '@shared/api.interface';

export async function getDashboardKpis(): Promise<DashboardKpis> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/kpis',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取仪表盘 KPI 失败', error);
    throw error;
  }
}

export async function getDefectSeverity(): Promise<DefectSeverityResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/defect-severity',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取缺陷严重程度分布失败', error);
    throw error;
  }
}

export async function getBusinessLineStats(): Promise<BusinessLineStatsResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/business-line-stats',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取业务线统计失败', error);
    throw error;
  }
}

export async function getVersionStatus(): Promise<VersionStatusResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/version-status',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取版本状态分布失败', error);
    throw error;
  }
}

export async function getRecentActivities(limit = 10): Promise<RecentActivitiesResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/dashboard/recent-activities?limit=${limit}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取最近动态失败', error);
    throw error;
  }
}
