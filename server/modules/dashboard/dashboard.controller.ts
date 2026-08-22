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
  async getKpis(@Query('planningVersion') planningVersion?: string): Promise<DashboardKpis> {
    return this.dashboardService.getKpis(planningVersion);
  }

  @Get('defect-severity')
  async getDefectSeverity(
    @Query('planningVersion') planningVersion?: string,
  ): Promise<DefectSeverityResponse> {
    return this.dashboardService.getDefectSeverity(planningVersion);
  }

  @Get('business-line-stats')
  async getBusinessLineStats(
    @Query('planningVersion') planningVersion?: string,
  ): Promise<BusinessLineStatsResponse> {
    return this.dashboardService.getBusinessLineStats(planningVersion);
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
