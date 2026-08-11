import { useSearchParams } from 'react-router-dom';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonnelGanttPage from '@/pages/personnel-gantt/PersonnelGanttPage';
import RequirementGanttPage from '@/pages/requirement-gantt/RequirementGanttPage';

type ScheduleTab = 'personnel' | 'requirement';

const ScheduleGanttPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: ScheduleTab = searchParams.get('tab') === 'requirement'
    ? 'requirement'
    : 'personnel';

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 pb-8">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
      >
        <TabsList className="h-10 rounded-sm border border-border bg-card p-1">
          <TabsTrigger value="personnel" className="rounded-sm px-4">
            人员排期
          </TabsTrigger>
          <TabsTrigger value="requirement" className="rounded-sm px-4">
            需求排期
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'personnel' ? <PersonnelGanttPage /> : <RequirementGanttPage />}
    </div>
  );
};

export default ScheduleGanttPage;
