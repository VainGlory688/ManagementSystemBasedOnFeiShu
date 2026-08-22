/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { date, foreignKey, index, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const project = pgTable("project", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  status: text("status"),
  description: text("description"),
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  createdBy: userProfile("_created_by"),
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_project_id").on(table.projectId),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const testPlan = pgTable("test_plan", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  planName: text("plan_name"),
  // Synced field: auto-synced, do not modify or delete
  testStatus: text("test_status"),
  // Synced field: auto-synced, do not modify or delete
  expectedStartDate: date("expected_start_date"),
  // Synced field: auto-synced, do not modify or delete
  expectedEndDate: date("expected_end_date"),
  // Synced field: auto-synced, do not modify or delete
  executor: userProfileArray("executor"),
  // Synced field: auto-synced, do not modify or delete
  priority: text("priority"),
  // Synced field: auto-synced, do not modify or delete
  testPlanType: text("test_plan_type"),
  // Synced field: auto-synced, do not modify or delete
  businessLine: text("business_line"),
  /**
   * 关联版本
   */
  // Synced field: auto-synced, do not modify or delete
  relatedVersion: jsonb("related_version"),
  projectId: text("project_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872669203503140").on(table.id),
  uniqueIndex("unq_1872669203504132").on(table.baseRecordId),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const defectItem = pgTable("defect_item", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  defectName: text("defect_name"),
  // Synced field: auto-synced, do not modify or delete
  status: text("status"),
  // Synced field: auto-synced, do not modify or delete
  severity: text("severity"),
  // Synced field: auto-synced, do not modify or delete
  priority: text("priority"),
  // Synced field: auto-synced, do not modify or delete
  currentOwner: userProfileArray("current_owner"),
  // Synced field: auto-synced, do not modify or delete
  businessLine: text("business_line"),
  // Synced field: auto-synced, do not modify or delete
  rejectionReason: text("rejection_reason"),
  // Synced field: auto-synced, do not modify or delete
  discoveryEnvironment: text("discovery_environment"),
  // Synced field: auto-synced, do not modify or delete
  testingStage: text("testing_stage"),
  // Synced field: auto-synced, do not modify or delete
  creator: userProfile("creator"),
  /**
   * 关联父单
   */
  // Synced field: auto-synced, do not modify or delete
  appParentOrder: jsonb("app_parent_order"),
  // Synced field: auto-synced, do not modify or delete
  detail: text("detail"),
  projectId: text("project_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872669203496980").on(table.id),
  uniqueIndex("unq_1872669203497012").on(table.baseRecordId),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const subRequirementItem = pgTable("sub_requirement_item", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  appSubRequirementName: text("app_sub_requirement_name"),
  // Synced field: auto-synced, do not modify or delete
  appStatus: text("app_status"),
  // Synced field: auto-synced, do not modify or delete
  appCurrentOwner: userProfile("app_current_owner"),
  // Synced field: auto-synced, do not modify or delete
  appExpectedStartDate: date("app_expected_start_date"),
  // Synced field: auto-synced, do not modify or delete
  appExpectedEndDate: date("app_expected_end_date"),
  // Synced field: auto-synced, do not modify or delete
  appOverdueDays: numeric("app_overdue_days"),
  // Synced field: auto-synced, do not modify or delete
  appPriority: text("app_priority"),
  /**
   * 父工作项
   */
  // Synced field: auto-synced, do not modify or delete
  appParentWorkItem: jsonb("app_parent_work_item"),
  // Synced field: auto-synced, do not modify or delete
  appDetails: text("app_details"),
  projectId: text("project_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872669203491060").on(table.id),
  uniqueIndex("unq_1872669203492116").on(table.baseRecordId),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const versionRequirement = pgTable("version_requirement", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  appReqName: text("app_req_name"),
  // Synced field: auto-synced, do not modify or delete
  currentOwner: userProfile("current_owner"),
  // Synced field: auto-synced, do not modify or delete
  priority: text("priority"),
  // Synced field: auto-synced, do not modify or delete
  businessLine: text("business_line"),
  // Synced field: auto-synced, do not modify or delete
  reqType: text("req_type"),
  // Synced field: auto-synced, do not modify or delete
  proposalTime: date("proposal_time"),
  // Synced field: auto-synced, do not modify or delete
  estimatedCompletionTime: date("estimated_completion_time"),
  // Synced field: auto-synced, do not modify or delete
  creator: userProfile("creator"),
  // Synced field: auto-synced, do not modify or delete
  planningVersion: text("planning_version"),
  /**
   * 子需求项
   */
  // Synced field: auto-synced, do not modify or delete
  subRequirementItem: jsonb("sub_requirement_item"),
  // Synced field: auto-synced, do not modify or delete
  description: text("description"),
  projectId: text("project_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872669203485860").on(table.id),
  uniqueIndex("unq_1872669203486852").on(table.baseRecordId),
  foreignKey({
    columns: [table.planningVersion],
    foreignColumns: [mainVersionManage.baseRecordId],
    name: "fk_relation_1872669203491012",
  }).onDelete("set null").onUpdate("cascade"),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const mainVersionManage = pgTable("main_version_manage", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  versionName: text("version_name"),
  // Synced field: auto-synced, do not modify or delete
  appStatus: text("app_status"),
  // Synced field: auto-synced, do not modify or delete
  versionDoc: text("version_doc"),
  // Synced field: auto-synced, do not modify or delete
  versionStartDate: date("version_start_date"),
  // Synced field: auto-synced, do not modify or delete
  packTime: date("pack_time"),
  // Synced field: auto-synced, do not modify or delete
  expectedTestTime: date("expected_test_time"),
  // Synced field: auto-synced, do not modify or delete
  versionCloseDate: date("version_close_date"),
  // Synced field: auto-synced, do not modify or delete
  actualGrayDate: date("actual_gray_date"),
  // Synced field: auto-synced, do not modify or delete
  actualReleaseDate: date("actual_release_date"),
  // Synced field: auto-synced, do not modify or delete
  versionRisk: text("version_risk"),
  // Synced field: auto-synced, do not modify or delete
  priority: text("priority"),
  // Synced field: auto-synced, do not modify or delete
  versionType: text("version_type"),
  // Synced field: auto-synced, do not modify or delete
  rollbackReasonAndProcess: text("rollback_reason_and_process"),
  projectId: text("project_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872669203480580").on(table.id),
  uniqueIndex("unq_1872669203480612").on(table.baseRecordId),
]);

// table aliases
export const defectItemTable = defectItem;
export const mainVersionManageTable = mainVersionManage;
export const projectTable = project;
export const subRequirementItemTable = subRequirementItem;
export const testPlanTable = testPlan;
export const versionRequirementTable = versionRequirement;
