import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import NotFound from './pages/NotFound/NotFound';
import DashboardPage from './pages/dashboard/DashboardPage';
import VersionListPage from './pages/version-list/VersionListPage';
import VersionDetailPage from './pages/version-detail/VersionDetailPage';
import RequirementListPage from './pages/requirement-list/RequirementListPage';
import RequirementDetailPage from './pages/requirement-detail/RequirementDetailPage';
import SubRequirementDetailPage from './pages/sub-requirement-detail/SubRequirementDetailPage';
import TestPlanListPage from './pages/test-plan-list/TestPlanListPage';
import TestPlanDetailPage from './pages/test-plan-detail/TestPlanDetailPage';
import DefectListPage from './pages/defect-list/DefectListPage';
import DefectDetailPage from './pages/defect-detail/DefectDetailPage';
import WorkbenchPage from './pages/workbench/WorkbenchPage';
import PersonnelGanttPage from './pages/personnel-gantt/PersonnelGanttPage';
import RequirementGanttPage from './pages/requirement-gantt/RequirementGanttPage';

const RoutesComponent = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<Layout />}>
          <Route index element={<PageTransition><DashboardPage /></PageTransition>} />
          <Route path="versions" element={<PageTransition><VersionListPage /></PageTransition>} />
          <Route path="versions/:id" element={<PageTransition><VersionDetailPage /></PageTransition>} />
          <Route path="requirements" element={<PageTransition><RequirementListPage /></PageTransition>} />
          <Route path="requirements/:id" element={<PageTransition><RequirementDetailPage /></PageTransition>} />
          <Route path="sub-requirements/:id" element={<PageTransition><SubRequirementDetailPage /></PageTransition>} />
          <Route path="test-plans" element={<PageTransition><TestPlanListPage /></PageTransition>} />
          <Route path="test-plans/:id" element={<PageTransition><TestPlanDetailPage /></PageTransition>} />
          <Route path="defects" element={<PageTransition><DefectListPage /></PageTransition>} />
          <Route path="defects/:id" element={<PageTransition><DefectDetailPage /></PageTransition>} />
          <Route path="workbench" element={<PageTransition><WorkbenchPage /></PageTransition>} />
          <Route path="personnel-gantt" element={<PageTransition><PersonnelGanttPage /></PageTransition>} />
          <Route path="requirement-gantt" element={<PageTransition><RequirementGanttPage /></PageTransition>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

export default RoutesComponent;
