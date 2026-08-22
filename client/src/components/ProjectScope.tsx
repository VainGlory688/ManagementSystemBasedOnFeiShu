import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';

export function ProjectScope() {
  const { projectId } = useParams<{ projectId: string }>();

  useEffect(() => {
    if (projectId) window.localStorage.setItem('current-project-id', projectId);
  }, [projectId]);

  return <Outlet />;
}

export function getCurrentProjectId(): string | undefined {
  return window.localStorage.getItem('current-project-id') || undefined;
}
