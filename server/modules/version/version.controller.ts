import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, NeedLogin, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  VersionListResponse,
  MainVersion,
  RequirementListResponse,
  VersionSummary,
  CreateVersionDto,
  UpdateVersionDto,
} from '@shared/api.interface';
import { VersionService } from './version.service';

@Controller('api/versions')
export class VersionController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly versionService: VersionService,
  ) {}

  @Get()
  async getList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('businessLine') businessLine?: string,
    @Query('versionType') versionType?: string,
    @Query('priority') priority?: string,
    @Query('keyword') keyword?: string,
    @Query('projectId') projectId?: string,
  ): Promise<VersionListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.versionService.getList({
      page: pageNum,
      pageSize: sizeNum,
      status,
      businessLine,
      versionType,
      priority,
      keyword,
      projectId,
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<MainVersion> {
    return this.versionService.getDetail(id, projectId);
  }

  @Get(':id/requirements')
  async getRequirements(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('projectId') projectId?: string,
  ): Promise<RequirementListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.versionService.getRequirements(id, pageNum, sizeNum, projectId);
  }

  @Get(':id/summary')
  async getSummary(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<VersionSummary> {
    return this.versionService.getSummary(id, projectId);
  }

  @NeedLogin()
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateVersionDto, @Query('projectId') projectId?: string): Promise<MainVersion> {
    const { userId } = req.userContext;
    return this.versionService.create(dto, userId, projectId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateVersionDto,
    @Query('projectId') projectId?: string,
  ): Promise<MainVersion> {
    return this.versionService.update(id, dto, req.userContext.userId, projectId);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<void> {
    return this.versionService.delete(id, projectId);
  }
}
