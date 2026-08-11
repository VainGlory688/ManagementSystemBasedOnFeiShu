import { Controller, Get, Param } from '@nestjs/common';
import { OptionsService, FieldOptions } from './options.service';

@Controller('api/options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Get()
  async getAll(): Promise<Record<string, string[]>> {
    return this.optionsService.getAllOptions();
  }

  @Get(':field')
  async getOne(@Param('field') field: string): Promise<FieldOptions> {
    return this.optionsService.getDistinct(field);
  }
}