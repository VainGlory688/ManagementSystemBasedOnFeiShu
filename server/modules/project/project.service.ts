import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { desc, eq, sql } from 'drizzle-orm';

import { project } from '@server/database/schema';
import type {
  CreateProjectDto,
  Project,
  ProjectListResponse,
  UpdateProjectDto,
} from '@shared/api.interface';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(): Promise<ProjectListResponse> {
    const items = await this.db.select().from(project).orderBy(desc(project.updatedAt));
    return { items: items.map((item) => this.mapProject(item)) };
  }

  async getDetail(projectId: string): Promise<Project> {
    const result = await this.db
      .select()
      .from(project)
      .where(eq(project.projectId, projectId))
      .limit(1);
    if (result.length === 0) throw new NotFoundException('项目不存在');
    return this.mapProject(result[0]);
  }

  async create(dto: CreateProjectDto, userId: string): Promise<Project> {
    if (!dto.projectId?.trim() || !dto.projectName?.trim()) {
      throw new BadRequestException('项目代号和项目名称不能为空');
    }
    const result = await this.db.execute(sql`
      INSERT INTO project (
        project_id, project_name, status, description, _created_by, _updated_by
      ) VALUES (
        ${dto.projectId.trim()}, ${dto.projectName.trim()}, ${dto.status || null},
        ${dto.description || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING project_id
    `);
    const rows = result as unknown as Array<{ project_id: string }>;
    if (rows.length === 0) throw new ConflictException('项目创建失败');
    return this.getDetail(rows[0].project_id);
  }

  async update(projectId: string, dto: UpdateProjectDto, userId: string): Promise<Project> {
    const current = await this.getDetail(projectId);
    if (dto.projectId && dto.projectId !== current.projectId) {
      throw new BadRequestException('项目代号创建后不可修改');
    }
    const result = await this.db.execute(sql`
      UPDATE project SET
        project_name = ${dto.projectName ?? current.projectName},
        status = ${(dto.status ?? current.status) || null},
        description = ${(dto.description ?? current.description) || null},
        _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null},
        _updated_at = NOW()
      WHERE project_id = ${projectId}
        AND (
          ${dto.expectedUpdatedAt || null}::timestamptz IS NULL
          OR date_trunc('milliseconds', _updated_at)
            = date_trunc('milliseconds', ${dto.expectedUpdatedAt || null}::timestamptz)
        )
      RETURNING project_id
    `);
    const rows = result as unknown as Array<{ project_id: string }>;
    if (rows.length === 0) {
      throw new ConflictException('项目已被其他人修改，请刷新后重试');
    }
    return this.getDetail(rows[0].project_id);
  }

  private mapProject(item: typeof project.$inferSelect): Project {
    return {
      id: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      status: item.status || '',
      description: item.description || undefined,
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
