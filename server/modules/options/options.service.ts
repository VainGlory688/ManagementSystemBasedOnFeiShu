import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { sql } from 'drizzle-orm';

export interface FieldOptions {
  field: string;
  values: string[];
}

const FIELD_MAP: Record<string, { table: string; column: string }> = {
  version_status: { table: 'main_version_manage', column: 'app_status' },
  version_priority: { table: 'main_version_manage', column: 'priority' },
  version_type: { table: 'main_version_manage', column: 'version_type' },
  req_priority: { table: 'version_requirement', column: 'priority' },
  req_business_line: { table: 'version_requirement', column: 'business_line' },
  req_type: { table: 'version_requirement', column: 'req_type' },
  sub_req_status: { table: 'sub_requirement_item', column: 'app_status' },
  sub_req_priority: { table: 'sub_requirement_item', column: 'app_priority' },
  defect_status: { table: 'defect_item', column: 'status' },
  defect_severity: { table: 'defect_item', column: 'severity' },
  defect_priority: { table: 'defect_item', column: 'priority' },
  defect_business_line: { table: 'defect_item', column: 'business_line' },
  defect_discovery_environment: { table: 'defect_item', column: 'discovery_environment' },
  defect_reject_reason: { table: 'defect_item', column: 'rejection_reason' },
  defect_testing_stage: { table: 'defect_item', column: 'testing_stage' },
  test_plan_status: { table: 'test_plan', column: 'test_status' },
  test_plan_priority: { table: 'test_plan', column: 'priority' },
  test_plan_type: { table: 'test_plan', column: 'test_plan_type' },
  test_plan_business_line: { table: 'test_plan', column: 'business_line' },
};

@Injectable()
export class OptionsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getDistinct(field: string): Promise<FieldOptions> {
    const config = FIELD_MAP[field];
    if (!config) {
      return { field, values: [] };
    }

    const result = await this.db.execute<{ val: string }>(
      sql`SELECT DISTINCT ${sql.raw(config.column)} as val FROM ${sql.raw(config.table)} WHERE ${sql.raw(config.column)} IS NOT NULL AND ${sql.raw(config.column)} != '' ORDER BY ${sql.raw(config.column)}`,
    );

    const rows = result as unknown as { val: string }[];
    return {
      field,
      values: (rows || []).map((r: { val: string }) => r.val).filter(Boolean),
    };
  }

  async getAllOptions(): Promise<Record<string, string[]>> {
    const fields = Object.keys(FIELD_MAP);

    const results = await Promise.all(fields.map((f: string) => this.getDistinct(f)));
    const map: Record<string, string[]> = {};
    for (const r of results) {
      map[r.field] = r.values;
    }
    return map;
  }
}