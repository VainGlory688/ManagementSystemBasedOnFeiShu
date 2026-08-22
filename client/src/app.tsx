import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import ExceptionItemsPage from './pages/exception-items/ExceptionItemsPage';
import ScheduleGanttPage from './pages/schedule-gantt/ScheduleGanttPage';
import ProjectListPage from './pages/project-list/ProjectListPage';
import { ProjectScope } from './components/ProjectScope';
import { ProjectRedirect } from './components/ProjectRedirect';

const RoutesComponent = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="projects" element={<ProjectListPage />} />
        <Route path="projects/:projectId" element={<ProjectScope />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
          <Route path="versions" element={<PageTransition><VersionListPage /></PageTransition>} />
          <Route path="versions/:id" element={<PageTransition><VersionDetailPage /></PageTransition>} />
          <Route path="requirements" element={<PageTransition><RequirementListPage /></PageTransition>} />
          <Route path="requirements/:id" element={<PageTransition><RequirementDetailPage /></PageTransition>} />
          <Route path="sub-requirements/:id" element={<PageTransition><SubRequirementDetailPage /></PageTransition>} />
          <Route path="test-plans" element={<PageTransition><TestPlanListPage /></PageTransition>} />
          <Route path="test-plans/:id" element={<PageTransition><TestPlanDetailPage /></PageTransition>} />
          <Route path="defects" element={<PageTransition><DefectListPage /></PageTransition>} />
          <Route path="defects/:id" element={<PageTransition><DefectDetailPage /></PageTransition>} />
          <Route path="exception-items" element={<PageTransition><ExceptionItemsPage /></PageTransition>} />
          <Route path="workbench" element={<PageTransition><WorkbenchPage /></PageTransition>} />
          <Route path="schedules" element={<PageTransition><ScheduleGanttPage /></PageTransition>} />
          <Route path="personnel-gantt" element={<Navigate to="/schedules?tab=personnel" replace />} />
          <Route path="requirement-gantt" element={<Navigate to="/schedules?tab=requirement" replace />} />
        </Route></Route>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<ProjectRedirect />} />
      </Routes>
    </AnimatePresence>
  );
};

export default RoutesComponent;
