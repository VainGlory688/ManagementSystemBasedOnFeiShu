import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { CreateProjectDto, Project, ProjectListResponse, UpdateProjectDto } from '@shared/api.interface';
import { ProjectService } from './project.service';

@Controller('api/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  getList(): Promise<ProjectListResponse> {
    return this.projectService.getList();
  }

  @Get(':projectId')
  getDetail(@Param('projectId') projectId: string): Promise<Project> {
    return this.projectService.getDetail(projectId);
  }

  @NeedLogin()
  @Post()
  create(@Req() req: Request, @Body() dto: CreateProjectDto): Promise<Project> {
    return this.projectService.create(dto, req.userContext.userId);
  }

  @NeedLogin()
  @Put(':projectId')
  update(
    @Param('projectId') projectId: string,
    @Req() req: Request,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectService.update(projectId, dto, req.userContext.userId);
  }
}
