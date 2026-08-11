import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getAllOptions } from '@/api/options';

// Fallback defaults matching Bitable data
const FALLBACK_OPTIONS: Record<string, string[]> = {
  // Version (main_version_manage)
  version_status: ['未启动', '开发中', '已结束'],
  version_priority: ['P0', 'P1', 'P2', '待定', '历史遗留'],
  version_type: ['主版本发布', '运营版本发布', 'Bug修复版本发布'],
  // version_business_line: ['客户端', '服务端', '美术', '策划'], //没用
  // Requirement (version_requirement)
  req_priority: ['P0', 'P1', 'P2', '待定', '历史遗留'],
  req_business_line: ['系统', '玩法', '活动', '其他'],
  req_type: ['需求开发迭代', '版本上线发布', '其他流程'],
  // Sub-requirement (sub_requirement_item)
  sub_req_status: ['待处理', '进行中', '已完成'],
  sub_req_priority: ['P0', 'P1', 'P2', '待定', '历史遗留'],
  // Defect (defect_item)
  defect_severity: ['紧急', '严重', '一般', '优化'],
  defect_priority: ['P0', 'P1', 'P2', '待定', '历史遗留'],
  defect_status: ['新问题', '提交测试', '测试未通过', '已关闭', '重新打开'],
  defect_business_line: ['系统', '玩法', '活动', '其他'],
  defect_discovery_environment: ['线上环境', '正式环境', '定向环境', '测试环境'],
  defect_reject_reason:['环境因素', '配置原因', '需求变更', '重复BUG', '设计如此', '不予解决', '转需求单'],
  defect_testing_stage: ['生产测试', '验收测试', '系统测试', '压力测试'],
  // Test Plan (test_plan)
  test_plan_status: ['未开始', '待排期', '进行中', '已完成', '暂停'],
  test_plan_priority: ['P0', 'P1', 'P2', '待定', '历史遗留'],
  test_plan_type: ['需求测试', '测试用例'],
  test_plan_business_line: ['系统', '玩法', '活动', '其他'],
};

export interface UseFieldOptionsResult {
  options: Record<string, string[]>;
  loading: boolean;
  error: string | null;
}

export function useFieldOptions(): UseFieldOptionsResult {
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAllOptions()
      .then((data: Record<string, string[]>) => {
        if (cancelled) return;
        setOptions(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : '加载选项失败';
        logger.error('加载字段选项失败', err);
        setError(message);
        setOptions(FALLBACK_OPTIONS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // const mergedOptions: Record<string, string[]> = {
  //   ...FALLBACK_OPTIONS,
  //   ...options,
  // };

  const mergedOptions: Record<string, string[]> = Object.fromEntries(
    Array.from(new Set([...Object.keys(FALLBACK_OPTIONS), ...Object.keys(options)])).map((field) => [
      field,
      [...new Set([...(FALLBACK_OPTIONS[field] || []), ...(options[field] || [])])],
    ]),
  );

  return { options: mergedOptions, loading, error };
}