import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  DashboardKpis,
  DefectSeverityResponse,
  BusinessLineStatsResponse,
  VersionStatusResponse,
  RecentActivitiesResponse,
} from '@shared/api.interface';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('kpis')
  async getKpis(): Promise<DashboardKpis> {
    return this.dashboardService.getKpis();
  }

  @Get('defect-severity')
  async getDefectSeverity(): Promise<DefectSeverityResponse> {
    return this.dashboardService.getDefectSeverity();
  }

  @Get('business-line-stats')
  async getBusinessLineStats(): Promise<BusinessLineStatsResponse> {
    return this.dashboardService.getBusinessLineStats();
  }

  @Get('version-status')
  async getVersionStatus(): Promise<VersionStatusResponse> {
    return this.dashboardService.getVersionStatus();
  }

  @Get('recent-activities')
  async getRecentActivities(
    @Query('limit') limit?: string,
  ): Promise<RecentActivitiesResponse> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentActivities(limitNum);
  }
}
