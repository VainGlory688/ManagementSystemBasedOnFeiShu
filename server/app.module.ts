import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { VersionModule } from './modules/version/version.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { TestPlanModule } from './modules/test-plan/test-plan.module';
import { DefectModule } from './modules/defect/defect.module';
import { WorkbenchModule } from './modules/workbench/workbench.module';
import { OptionsModule } from './modules/options/options.module';
import { SubRequirementModule } from './modules/sub-requirement/sub-requirement.module';
import { ViewModule } from './modules/view/view.module';
import { ProjectModule } from './modules/project/project.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    DashboardModule,
    ProjectModule,
    VersionModule,
    RequirementModule,
    TestPlanModule,
    DefectModule,
    WorkbenchModule,
    OptionsModule,
    SubRequirementModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
