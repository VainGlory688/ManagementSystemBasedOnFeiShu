import { Module } from '@nestjs/common';
import { DefectController } from './defect.controller';
import { DefectService } from './defect.service';

@Module({
  controllers: [DefectController],
  providers: [DefectService],
})
export class DefectModule {}
