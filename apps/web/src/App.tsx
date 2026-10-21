import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';

import { Login } from './pages/Login';
import { GuildSelect } from './pages/GuildSelect';
import { Overview } from './pages/Overview';
import { RolesPage } from './pages/RolesPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { MembersPage } from './pages/MembersPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { EventsPage } from './pages/EventsPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ModerationPage } from './pages/ModerationPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { CandidaturesPage } from './pages/CandidaturesPage';
import { SuggestionsPage } from './pages/SuggestionsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/guilds" element={<GuildSelect />} />

            <Route path="/dashboard/:guildId" element={<DashboardLayout />}>
              <Route index element={<Overview />} />
              <Route path="departments" element={<DepartmentsPage />} />
              <Route path="candidatures" element={<CandidaturesPage />} />
              <Route path="suggestions" element={<SuggestionsPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="channels" element={<ChannelsPage />} />
              <Route path="permissions" element={<PermissionsPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="moderation" element={<ModerationPage />} />
              <Route path="config" element={<ConfigEditorPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/guilds" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
