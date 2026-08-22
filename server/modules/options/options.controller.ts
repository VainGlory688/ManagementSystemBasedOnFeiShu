import { Controller, Get, Param, Query } from '@nestjs/common';
import { OptionsService, FieldOptions } from './options.service';

@Controller('api/options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Get()
  async getAll(@Query('projectId') projectId?: string): Promise<Record<string, string[]>> {
    return this.optionsService.getAllOptions(projectId);
  }

  @Get(':field')
  async getOne(
    @Param('field') field: string,
    @Query('projectId') projectId?: string,
  ): Promise<FieldOptions> {
    return this.optionsService.getDistinct(field, projectId);
  }
}