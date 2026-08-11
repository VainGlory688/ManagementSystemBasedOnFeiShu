import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountUp from 'react-countup';
import { ListTodo, Bug, ClipboardList, type LucideIcon } from 'lucide-react';
import type { WorkbenchOverview } from '@shared/api.interface';

interface WorkbenchStatsProps {
  overview: WorkbenchOverview | null;
}

interface StatCardConfig {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  gradient: string;
  accent: string;
}

const WorkbenchStats = ({ overview }: WorkbenchStatsProps) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const cards: StatCardConfig[] = [
    {
      key: 'req',
      label: '分配给我的需求',
      value: overview?.myRequirementCount ?? 0,
      icon: ListTodo,
      href: '/requirements?currentOwner=me',
      gradient: 'from-[hsl(215_60%_96%)] to-[hsl(215_40%_99%)]',
      accent: 'text-[hsl(215_60%_32%)]',
    },
    {
      key: 'defect',
      label: '指派给我的缺陷',
      value: overview?.myDefectCount ?? 0,
      icon: Bug,
      href: '/defects?currentOwner=me',
      gradient: 'from-[hsl(4_60%_97%)] to-[hsl(10_50%_99%)]',
      accent: 'text-[hsl(4_70%_48%)]',
    },
    {
      key: 'test',
      label: '我参与的测试计划',
      value: overview?.myTestPlanCount ?? 0,
      icon: ClipboardList,
      href: '/test-plans?executor=me',
      gradient: 'from-[hsl(160_40%_96%)] to-[hsl(160_30%_99%)]',
      accent: 'text-[hsl(160_55%_38%)]',
    },
  ];

  return (
    <div
      data-ai-section-type="card-stat"
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
    >
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => navigate(card.href)}
            className={`group text-left relative overflow-hidden rounded-sm border border-border bg-gradient-to-br ${card.gradient} p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
            style={{ transitionDelay: `${index * 100 + 120}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <div className={`mt-3 font-mono text-4xl font-semibold ${card.accent}`}>
                  {visible ? (
                    <CountUp end={card.value} duration={0.6} start={0} />
                  ) : (
                    '0'
                  )}
                </div>
              </div>
              <div className={`${card.accent} opacity-80 group-hover:opacity-100 transition-opacity`}>
                <Icon className="size-6" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors">
              <span>查看全部</span>
              <svg
                className="ml-1 size-3 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export { WorkbenchStats };
