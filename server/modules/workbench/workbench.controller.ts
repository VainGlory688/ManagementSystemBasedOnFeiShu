import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin, DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  WorkbenchOverview,
  MyRequirementListResponse,
  MyDefectListResponse,
  MyVersionListResponse,
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
  async getOverview(@Req() req: Request): Promise<WorkbenchOverview> {
    const userId = req.userContext?.userId || '';
    return this.workbenchService.getOverview(userId);
  }

  @NeedLogin()
  @Get('my-requirements')
  async getMyRequirements(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'priority',
    @Query('status') status?: string,
  ): Promise<MyRequirementListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyRequirements(userId, pageNum, sizeNum, sort, status);
  }

  @NeedLogin()
  @Get('my-defects')
  async getMyDefects(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'priority',
    @Query('status') status?: string,
  ): Promise<MyDefectListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyDefects(userId, pageNum, sizeNum, sort, status);
  }

  @NeedLogin()
  @Get('my-versions')
  async getMyVersions(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'name',
  ): Promise<MyVersionListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return this.workbenchService.getMyVersions(userId, pageNum, sizeNum, sort);
  }
}
