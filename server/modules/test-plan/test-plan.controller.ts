import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, NeedLogin, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  TestPlanListResponse,
  TestPlan,
  CreateTestPlanDto,
  UpdateTestPlanDto,
} from '@shared/api.interface';
import { TestPlanService } from './test-plan.service';

@Controller('api/test-plans')
export class TestPlanController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly testPlanService: TestPlanService,
  ) {}

  @Get()
  async getList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('testStatus') testStatus?: string,
    @Query('priority') priority?: string,
    @Query('testPlanType') testPlanType?: string,
    @Query('businessLine') businessLine?: string,
    @Query('planningVersion') planningVersion?: string,
    @Query('executor') executor?: string,
    @Query('keyword') keyword?: string,
  ): Promise<TestPlanListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.testPlanService.getList({
      page: pageNum,
      pageSize: sizeNum,
      testStatus,
      priority,
      testPlanType,
      businessLine,
      planningVersion,
      executor: executor === 'me' ? req.userContext?.userId || '' : executor,
      keyword,
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string): Promise<TestPlan> {
    return this.testPlanService.getDetail(id);
  }

  @NeedLogin()
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTestPlanDto): Promise<TestPlan> {
    const { userId } = req.userContext;
    return this.testPlanService.create(dto, userId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestPlanDto,
  ): Promise<TestPlan> {
    return this.testPlanService.update(id, dto);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.testPlanService.delete(id);
  }
}
