import { Module } from '@nestjs/common';
import { SubRequirementController } from './sub-requirement.controller';
import { SubRequirementService } from './sub-requirement.service';

@Module({
  controllers: [SubRequirementController],
  providers: [SubRequirementService],
})
export class SubRequirementModule {}