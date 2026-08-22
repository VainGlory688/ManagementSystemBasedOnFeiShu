import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, NeedLogin, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  DefectListResponse,
  DefectItem,
  CreateDefectDto,
  UpdateDefectDto,
} from '@shared/api.interface';
import { DefectService } from './defect.service';

@Controller('api/defects')
export class DefectController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly defectService: DefectService,
  ) {}

  @Get()
  async getList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('priority') priority?: string,
    @Query('businessLine') businessLine?: string,
    @Query('discoveryEnvironment') discoveryEnvironment?: string,
    @Query('testingStage') testingStage?: string,
    @Query('planningVersion') planningVersion?: string,
    @Query('currentOwner') currentOwner?: string,
    @Query('keyword') keyword?: string,
  ): Promise<DefectListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.defectService.getList({
      page: pageNum,
      pageSize: sizeNum,
      status,
      severity,
      priority,
      businessLine,
      discoveryEnvironment,
      testingStage,
      planningVersion,
      currentOwner: currentOwner === 'me' ? req.userContext?.userId || '' : currentOwner,
      keyword,
    });
  }

  @Get(':id')
  async getDetail(@Param('id') id: string): Promise<DefectItem> {
    return this.defectService.getDetail(id);
  }

  @NeedLogin()
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateDefectDto): Promise<DefectItem> {
    const { userId } = req.userContext;
    return this.defectService.create(dto, userId);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateDefectDto,
  ): Promise<DefectItem> {
    return this.defectService.update(id, dto, req.userContext.userId);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.defectService.delete(id);
  }
}
