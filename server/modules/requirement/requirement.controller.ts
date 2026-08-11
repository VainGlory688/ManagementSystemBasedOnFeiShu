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
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string): Promise<VersionRequirement> {
    return this.requirementService.getDetail(id);
  }

  @Get(':id/sub-items')
  async getSubItems(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<SubRequirementListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.requirementService.getSubItems(id, pageNum, sizeNum);
  }

  @NeedLogin()
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRequirementDto): Promise<VersionRequirement> {
    const { userId } = req.userContext;
    return this.requirementService.create(dto, userId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateRequirementDto,
  ): Promise<VersionRequirement> {
    return this.requirementService.update(id, dto, req.userContext.userId);
  }

  @NeedLogin()
  @Put(':id/pipeline')
  async updatePipeline(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateRequirementPipelineDto,
  ): Promise<RequirementPipelineConfig> {
    return this.requirementService.updatePipeline(id, dto, req.userContext.userId);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.requirementService.delete(id);
  }
}
