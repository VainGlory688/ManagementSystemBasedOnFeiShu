import { describe, expect, it } from '@jest/globals';
import {
  aggregateRequirementStatus,
  getBlockedPipelineNodeIds,
  getIncompletePipelinePredecessorIds,
  resizeGanttEndDate,
  shiftGanttDates,
} from '../../shared/requirement-business-rules';

describe('需求状态聚合规则', () => {
  const today = new Date('2026-08-22T12:00:00');

  it('子需求为空时返回待拆分', () => {
    expect(aggregateRequirementStatus([], today)).toBe('待拆分');
  });

  it('全部子需求完成时返回已完成', () => {
    expect(aggregateRequirementStatus([
      { appStatus: '已完成', appExpectedEndDate: '2026-08-01' },
      { appStatus: '已完成', appExpectedEndDate: '2026-08-20' },
    ], today)).toBe('已完成');
  });

  it('存在未完成且逾期的子需求时返回已逾期', () => {
    expect(aggregateRequirementStatus([
      { appStatus: '已完成', appExpectedEndDate: '2026-08-01' },
      { appStatus: '进行中', appExpectedEndDate: '2026-08-21' },
    ], today)).toBe('已逾期');
  });

  it('子需求尚未逾期时返回进行中', () => {
    expect(aggregateRequirementStatus([
      { appStatus: '未处理', appExpectedEndDate: '2026-08-22' },
      { appStatus: '进行中', appExpectedEndDate: '2026-08-23' },
    ], today)).toBe('进行中');
  });
});

describe('流水线阻塞规则', () => {
  const edges = [
    { source: 'design', target: 'develop' },
    { source: 'develop', target: 'test' },
  ];

  it('已完成和已上线的前置不会阻塞后续节点', () => {
    expect(getBlockedPipelineNodeIds([
      { id: 'design', status: '已完成' },
      { id: 'develop', status: '已上线' },
      { id: 'test', status: '未处理' },
    ], edges)).toEqual(new Set());
  });

  it('任一未完成的前置会阻塞直接后续节点', () => {
    expect(getBlockedPipelineNodeIds([
      { id: 'design', status: '进行中' },
      { id: 'develop', status: '未处理' },
      { id: 'test', status: '未处理' },
    ], edges)).toEqual(new Set(['develop', 'test']));
  });

  it('忽略指向当前子需求集合之外的连线', () => {
    expect(getBlockedPipelineNodeIds(
      [{ id: 'design', status: '进行中' }],
      [{ source: 'design', target: 'deleted-task' }],
    )).toEqual(new Set());
  });

  it('完成子需求前仅返回其未完成的直接前置节点', () => {
    expect(getIncompletePipelinePredecessorIds('test', [
      { id: 'design', status: '已完成' },
      { id: 'develop', status: '进行中' },
      { id: 'test', status: '未处理' },
    ], edges)).toEqual(['develop']);
  });
});

describe('甘特改期日期规则', () => {
  it('整体平移保持原有工期', () => {
    expect(shiftGanttDates('2026-08-10', '2026-08-14', 3)).toEqual({
      startDate: '2026-08-13',
      endDate: '2026-08-17',
    });
  });

  it('结束日期不能早于开始日期，保证最小一天工期', () => {
    expect(resizeGanttEndDate(
      '2026-08-10',
      '2026-08-14',
      -10,
    )).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });
  });

  it('调整跨出视窗的任务时，增量基于实际结束日期而非显示裁剪日期', () => {
    expect(resizeGanttEndDate(
      '2026-08-10',
      '2026-08-30',
      -1,
    )).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-08-29',
    });
  });

  it('结束日期可延长至当前视窗之外', () => {
    expect(resizeGanttEndDate(
      '2026-08-10',
      '2026-08-20',
      20,
    )).toEqual({
      startDate: '2026-08-10',
      endDate: '2026-09-09',
    });
  });
});
