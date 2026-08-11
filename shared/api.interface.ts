export interface DashboardKpis {
  activeVersions: number;
  pendingRequirements: number;
  activeDefects: number;
  activeTestPlans: number;
}

export interface DefectSeverityStat {
  severity: string;
  count: number;
}

export interface DefectSeverityResponse {
  items: DefectSeverityStat[];
}

export interface BusinessLineStat {
  businessLine: string;
  requirementCount: number;
  defectCount: number;
}

export interface BusinessLineStatsResponse {
  items: BusinessLineStat[];
}

export interface VersionStatusStat {
  status: string;
  count: number;
}

export interface VersionStatusResponse {
  items: VersionStatusStat[];
}

export type ActivityType = 'version' | 'requirement' | 'defect';

export interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  status: string;
  updatedAt: string;
  ownerName?: string;
  ownerId?: string;
  targetId: string;
}

export interface RecentActivitiesResponse {
  items: RecentActivity[];
}

export interface MainVersion {
  id: string;
  baseRecordId: string;
  updatedAt: string;
  versionName: string;
  appStatus: string;
  priority: string;
  versionType: string;
  businessLine: string;
  versionDoc?: string;
  versionRisk?: string;
  versionStartDate: string;
  packTime: string;
  expectedTestTime: string;
  versionCloseDate: string;
  actualGrayDate?: string;
  actualReleaseDate?: string;
  rollbackReasonAndProcess?: string;
}

export interface VersionListResponse {
  items: MainVersion[];
  total: number;
}

export interface VersionSummary {
  testPlanCount: number;
  defectCount: number;
  defectBySeverity: DefectSeverityStat[];
}

export interface VersionRequirement {
  id: string;
  baseRecordId: string;
  updatedAt: string;
  appReqName: string;
  currentOwner: string;
  currentStatus: RequirementCurrentStatus;
  priority: string;
  appStatus?: string;
  reqType: string;
  businessLine: string;
  planningVersion: string;
  planningVersionName?: string;
  planningVersionId?: string;
  proposalTime: string;
  estimatedCompletionTime: string;
  creator: string;
  description?: string;
  pipeline?: RequirementPipelineConfig;
}

export type RequirementCurrentStatus =
  | '待拆分'
  | '进行中'
  | '已完成'
  | '已逾期';

export interface RequirementPipelineEdge {
  source: string;
  target: string;
}

export interface RequirementPipelineConfig {
  edges: RequirementPipelineEdge[];
}

export interface UpdateRequirementPipelineDto {
  edges: RequirementPipelineEdge[];
  expectedUpdatedAt?: string;
}

export interface RequirementListResponse {
  items: VersionRequirement[];
  total: number;
}

export interface SubRequirementItem {
  id: string;
  baseRecordId: string;
  updatedAt: string;
  appSubRequirementName: string;
  appStatus: string;
  appCurrentOwner: string;
  appExpectedStartDate: string;
  appExpectedEndDate: string;
  appOverdueDays: number;
  appPriority: string;
  appParentWorkItemName?: string;
  appParentWorkItemRecordId?: string;
  appDetails?: string;
}

export interface SubRequirementListResponse {
  items: SubRequirementItem[];
  total: number;
}

export interface TestPlan {
  id: string;
  baseRecordId: string;
  updatedAt: string;
  planName: string;
  testStatus: string;
  priority: string;
  testPlanType: string;
  businessLine: string;
  executor: string[];
  expectedStartDate: string;
  expectedEndDate: string;
  relatedVersion?: string;
  relatedVersionName?: string;
}

export interface TestPlanListResponse {
  items: TestPlan[];
  total: number;
}

export interface DefectItem {
  id: string;
  baseRecordId: string;
  updatedAt: string;
  defectName: string;
  status: string;
  severity: string;
  priority: string;
  currentOwner: string[];
  businessLine: string;
  rejectionReason?: string;
  discoveryEnvironment: string;
  testingStage: string;
  creator: string;
  createdAt: string;
  detail?: string;
  appParentOrderName?: string;
  appParentOrderRecordId?: string;
  relatedVersionName?: string;
  relatedTestPlanName?: string;
}

export interface DefectListResponse {
  items: DefectItem[];
  total: number;
}

export interface WorkbenchOverview {
  myRequirementCount: number;
  myDefectCount: number;
  myTestPlanCount: number;
}

export interface MyRequirementItem {
  id: string;
  baseRecordId: string;
  appReqName: string;
  priority: string;
  appStatus: string;
  planningVersionName?: string;
  estimatedCompletionTime: string;
}

export interface MyRequirementListResponse {
  items: MyRequirementItem[];
  total: number;
}

export interface MyDefectItem {
  id: string;
  baseRecordId: string;
  defectName: string;
  severity: string;
  priority: string;
  status: string;
  relatedVersionName?: string;
  overdue: boolean;
}

export interface MyDefectListResponse {
  items: MyDefectItem[];
  total: number;
}

export interface MyVersionItem {
  id: string;
  baseRecordId: string;
  versionName: string;
  appStatus: string;
  currentMilestone: string;
}

export interface MyVersionListResponse {
  items: MyVersionItem[];
  total: number;
}

// ===== Create/Update DTOs =====

export interface CreateVersionDto {
  versionName: string;
  appStatus?: string;
  priority?: string;
  versionType?: string;
  businessLine?: string;
  versionDoc?: string;
  versionRisk?: string;
  versionStartDate?: string;
  packTime?: string;
  expectedTestTime?: string;
  versionCloseDate?: string;
  actualGrayDate?: string;
  actualReleaseDate?: string;
  rollbackReasonAndProcess?: string;
}

export interface UpdateVersionDto extends Partial<CreateVersionDto> {
  expectedUpdatedAt?: string;
}

export interface CreateRequirementDto {
  appReqName: string;
  currentOwner?: string;
  priority?: string;
  reqType?: string;
  businessLine?: string;
  planningVersion?: string;
  proposalTime?: string;
  estimatedCompletionTime?: string;
  description?: string;
}

export interface UpdateRequirementDto extends Partial<CreateRequirementDto> {
  expectedUpdatedAt?: string;
}

export interface CreateSubRequirementDto {
  appSubRequirementName: string;
  appStatus?: string;
  appCurrentOwner?: string;
  appExpectedStartDate?: string;
  appExpectedEndDate?: string;
  appPriority?: string;
  appParentWorkItem?: string;
  appDetails?: string;
}

export interface UpdateSubRequirementDto extends Partial<CreateSubRequirementDto> {
  expectedUpdatedAt?: string;
}

export interface CreateTestPlanDto {
  planName: string;
  testStatus?: string;
  priority?: string;
  testPlanType?: string;
  businessLine?: string;
  executor?: string[];
  expectedStartDate?: string;
  expectedEndDate?: string;
  relatedVersion?: string;
}

export interface UpdateTestPlanDto extends Partial<CreateTestPlanDto> {
  expectedUpdatedAt?: string;
}

export interface CreateDefectDto {
  defectName: string;
  status?: string;
  severity?: string;
  priority?: string;
  currentOwner?: string[];
  businessLine?: string;
  rejectionReason?: string;
  discoveryEnvironment?: string;
  testingStage?: string;
  detail?: string;
  appParentOrder?: string;
}

export interface UpdateDefectDto extends Partial<CreateDefectDto> {
  expectedUpdatedAt?: string;
}
