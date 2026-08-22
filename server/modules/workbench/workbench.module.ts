import { Module } from '@nestjs/common';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';
import { RequirementModule } from '../requirement/requirement.module';

@Module({
  imports: [RequirementModule],
  controllers: [WorkbenchController],
  providers: [WorkbenchService],
})
export class WorkbenchModule {}
