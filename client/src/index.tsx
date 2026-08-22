import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AppContainer } from '@lark-apaas/client-toolkit/components/AppContainer';
import { ErrorRender } from '@lark-apaas/client-toolkit/components/ErrorRender';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';
import { OpeningSplash } from '@/components/OpeningSplash';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { getCurrentProjectId } from '@/components/ProjectScope';

const CLIENT_BASE_PATH = process.env.CLIENT_BASE_PATH || '/';

applyTheme(getStoredTheme());

axiosForBackend.interceptors.request.use((config) => {
  const projectId = getCurrentProjectId();
  if (!projectId || !config.url?.startsWith('/api/') || config.url.startsWith('/api/projects')) {
    return config;
  }
  const [path, query = ''] = config.url.split('?');
  const params = new URLSearchParams(query);
  params.set('projectId', projectId);
  config.url = `${path}?${params.toString()}`;
  return config;
});

const MainApp = () => {
  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <AppContainer defaultTheme="light">
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender
              error={error as Error}
              resetErrorBoundary={resetErrorBoundary}
            />
          )}
        >
          <RoutesComponent />
          {createPortal(<Toaster />, document.body)}
          <OpeningSplash />
        </ErrorBoundary>
      </AppContainer>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);
