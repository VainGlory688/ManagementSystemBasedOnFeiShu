import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, NeedLogin, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  RequirementListResponse,
  VersionRequirement,
  SubRequirementListResponse,
  CreateRequirementDto,
  UpdateRequirementDto,
  RequirementPipelineConfig,
  UpdateRequirementPipelineDto,
  ExceptionItemsResponse,
} from '@shared/api.interface';
import { RequirementService } from './requirement.service';

@Controller('api/requirements')
export class RequirementController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly requirementService: RequirementService,
  ) {}

  @Get()
  async getList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('businessLine') businessLine?: string,
    @Query('priority') priority?: string,
    @Query('reqType') reqType?: string,
    @Query('planningVersion') planningVersion?: string,
    @Query('currentOwner') currentOwner?: string,
    @Query('currentStatus') currentStatus?: string,
    @Query('keyword') keyword?: string,
    @Query('projectId') projectId?: string,
  ): Promise<RequirementListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.requirementService.getList({
      page: pageNum,
      pageSize: sizeNum,
      businessLine,
      priority,
      reqType,
      planningVersion,
      currentOwner: currentOwner === 'me' ? req.userContext?.userId || '' : currentOwner,
      currentStatus,
      keyword,
      projectId,
    });
  }

  @Get('exceptions')
  async getExceptionItems(
    @Req() req: Request,
    @Query('businessLine') businessLine?: string,
    @Query('priority') priority?: string,
    @Query('reqType') reqType?: string,
    @Query('planningVersion') planningVersion?: string,
    @Query('currentOwner') currentOwner?: string,
    @Query('keyword') keyword?: string,
    @Query('subPriority') subPriority?: string,
    @Query('subOwner') subOwner?: string,
    @Query('subKeyword') subKeyword?: string,
    @Query('projectId') projectId?: string,
  ): Promise<ExceptionItemsResponse> {
    return this.requirementService.getExceptionItems({
      businessLine,
      priority,
      reqType,
      planningVersion,
      currentOwner: currentOwner === 'me' ? req.userContext?.userId || '' : currentOwner,
      keyword,
      subPriority,
      subOwner,
      subKeyword,
      projectId,
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<VersionRequirement> {
    return this.requirementService.getDetail(id, projectId);
  }

  @Get(':id/sub-items')
  async getSubItems(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('projectId') projectId?: string,
  ): Promise<SubRequirementListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.requirementService.getSubItems(id, pageNum, sizeNum, projectId);
  }

  @NeedLogin()
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateRequirementDto,
    @Query('projectId') projectId?: string,
  ): Promise<VersionRequirement> {
    const { userId } = req.userContext;
    return this.requirementService.create(dto, userId, projectId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateRequirementDto,
    @Query('projectId') projectId?: string,
  ): Promise<VersionRequirement> {
    return this.requirementService.update(id, dto, req.userContext.userId, projectId);
  }

  @NeedLogin()
  @Put(':id/pipeline')
  async updatePipeline(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateRequirementPipelineDto,
    @Query('projectId') projectId?: string,
  ): Promise<RequirementPipelineConfig> {
    return this.requirementService.updatePipeline(id, dto, req.userContext.userId, projectId);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<void> {
    return this.requirementService.delete(id, projectId);
  }
}
