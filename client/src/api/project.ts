import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { CreateProjectDto, Project, ProjectListResponse, UpdateProjectDto } from '@shared/api.interface';

export async function getProjectList(): Promise<ProjectListResponse> {
  const response = await axiosForBackend({ url: '/api/projects', method: 'GET' });
  return response.data;
}

export async function getProjectDetail(projectId: string): Promise<Project> {
  const response = await axiosForBackend({ url: `/api/projects/${projectId}`, method: 'GET' });
  return response.data;
}

export async function createProject(dto: CreateProjectDto): Promise<Project> {
  const response = await axiosForBackend({ url: '/api/projects', method: 'POST', data: dto });
  return response.data;
}

export async function updateProject(projectId: string, dto: UpdateProjectDto): Promise<Project> {
  const response = await axiosForBackend({ url: `/api/projects/${projectId}`, method: 'PUT', data: dto });
  return response.data;
}
