import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin, DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  WorkbenchOverview,
  MyRequirementListResponse,
  MyDefectListResponse,
  MyTestPlanListResponse,
  MyVersionListResponse,
  MyBlockedSubRequirementListResponse,
} from '@shared/api.interface';
import { WorkbenchService } from './workbench.service';

@Controller('api/workbench')
export class WorkbenchController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly workbenchService: WorkbenchService,
  ) {}

  @NeedLogin()
  @Get('overview')
  async getOverview(
    @Req() req: Request,
    @Query('projectId') projectId?: string,
  ): Promise<WorkbenchOverview> {
    const userId = req.userContext?.userId || '';
    return this.workbenchService.getOverview(userId, projectId);
  }

  @NeedLogin()
  @Get('my-requirements')
  async getMyRequirements(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'priority',
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
  ): Promise<MyRequirementListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyRequirements(
      userId, pageNum, sizeNum, sort, status, projectId,
    );
  }

  @NeedLogin()
  @Get('my-defects')
  async getMyDefects(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'priority',
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
  ): Promise<MyDefectListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyDefects(
      userId, pageNum, sizeNum, sort, status, projectId,
    );
  }

  @NeedLogin()
  @Get('my-test-plans')
  async getMyTestPlans(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('projectId') projectId?: string,
  ): Promise<MyTestPlanListResponse> {
    const userId = req.userContext?.userId || '';
    return this.workbenchService.getMyTestPlans(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
      projectId,
    );
  }

  @NeedLogin()
  @Get('my-versions')
  async getMyVersions(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'name',
    @Query('projectId') projectId?: string,
  ): Promise<MyVersionListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyVersions(userId, pageNum, sizeNum, sort, projectId);
  }

  @NeedLogin()
  @Get('my-blocked-sub-requirements')
  async getMyBlockedSubRequirements(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('projectId') projectId?: string,
  ): Promise<MyBlockedSubRequirementListResponse> {
    const userId = req.userContext?.userId || '';
    return this.workbenchService.getMyBlockedSubRequirements(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
      projectId,
    );
  }
}
