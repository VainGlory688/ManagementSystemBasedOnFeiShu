import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, NeedLogin, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  SubRequirementListResponse,
  SubRequirementItem,
  CreateSubRequirementDto,
  UpdateSubRequirementDto,
} from '@shared/api.interface';
import { SubRequirementService } from './sub-requirement.service';

@Controller('api/sub-requirements')
export class SubRequirementController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly subRequirementService: SubRequirementService,
  ) {}

  @Get()
  async getList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('appStatus') appStatus?: string,
    @Query('appPriority') appPriority?: string,
    @Query('projectId') projectId?: string,
  ): Promise<SubRequirementListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.subRequirementService.getList({
      page: pageNum,
      pageSize: sizeNum,
      keyword,
      appStatus,
      appPriority,
      projectId,
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string, @Query('projectId') projectId?: string): Promise<SubRequirementItem> {
    return this.subRequirementService.getDetail(id, projectId);
  }

  @NeedLogin()
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateSubRequirementDto,
    @Query('projectId') projectId?: string,
  ): Promise<SubRequirementItem> {
    const { userId } = req.userContext;
    return this.subRequirementService.create(dto, userId, projectId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateSubRequirementDto,
    @Query('projectId') projectId?: string,
  ): Promise<SubRequirementItem> {
    return this.subRequirementService.update(id, dto, req.userContext.userId, projectId);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request, @Query('projectId') projectId?: string): Promise<void> {
    return this.subRequirementService.delete(id, req.userContext.userId, projectId);
  }
}