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
  async getKpis(
    @Query('planningVersion') planningVersion?: string,
    @Query('projectId') projectId?: string,
  ): Promise<DashboardKpis> {
    return this.dashboardService.getKpis(planningVersion, projectId);
  }

  @Get('defect-severity')
  async getDefectSeverity(
    @Query('planningVersion') planningVersion?: string,
    @Query('projectId') projectId?: string,
  ): Promise<DefectSeverityResponse> {
    return this.dashboardService.getDefectSeverity(planningVersion, projectId);
  }

  @Get('business-line-stats')
  async getBusinessLineStats(
    @Query('planningVersion') planningVersion?: string,
    @Query('projectId') projectId?: string,
  ): Promise<BusinessLineStatsResponse> {
    return this.dashboardService.getBusinessLineStats(planningVersion, projectId);
  }

  @Get('version-status')
  async getVersionStatus(@Query('projectId') projectId?: string): Promise<VersionStatusResponse> {
    return this.dashboardService.getVersionStatus(projectId);
  }

  @Get('recent-activities')
  async getRecentActivities(
    @Query('limit') limit?: string,
    @Query('projectId') projectId?: string,
  ): Promise<RecentActivitiesResponse> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentActivities(limitNum, projectId);
  }
}
