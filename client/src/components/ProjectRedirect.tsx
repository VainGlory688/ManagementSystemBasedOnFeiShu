import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentProjectId } from './ProjectScope';

export function ProjectRedirect() {
  const location = useLocation();
  const projectId = getCurrentProjectId();
  if (!projectId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/projects/${projectId}${location.pathname}${location.search}`} replace />;
}
