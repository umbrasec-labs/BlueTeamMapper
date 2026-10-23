import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { RadialView } from '@/views/RadialView';

// The lifecycle map is the landing view and ships in the main bundle.
// Everything else, and React Flow in particular, loads on demand.
const LayersView = lazy(() => import('@/views/LayersView'));
const FlowsView = lazy(() => import('@/views/FlowsView'));
const RunbooksView = lazy(() => import('@/views/RunbooksView'));
const RunbookRunView = lazy(() => import('@/views/RunbookRunView'));
const MatrixView = lazy(() => import('@/views/MatrixView'));
const DetectionsView = lazy(() => import('@/views/DetectionsView'));
const CoverageView = lazy(() => import('@/views/CoverageView'));
const SkillView = lazy(() => import('@/views/SkillView'));
const AttackView = lazy(() => import('@/views/AttackView'));
const EventsView = lazy(() => import('@/views/EventsView'));
const ToolsView = lazy(() => import('@/views/ToolsView'));
const SectionView = lazy(() => import('@/views/SectionView'));
const AboutView = lazy(() => import('@/views/AboutView'));
const NotFound = lazy(() => import('@/views/NotFound'));

export function App() {
  return (
    // Vite's BASE_URL ("/BlueTeamMapper/" on GitHub Pages) becomes the router basename.
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <MotionConfig reducedMotion="user">
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<RadialView />} />
            <Route path="layers" element={<LayersView />} />
            <Route path="layers/:layerId" element={<LayersView />} />
            <Route path="flows" element={<FlowsView />} />
            <Route path="flows/:chainId" element={<FlowsView />} />
            <Route path="runbooks" element={<RunbooksView />} />
            <Route path="runbooks/:runId" element={<RunbookRunView />} />
            <Route path="matrix" element={<MatrixView />} />
            <Route path="detections" element={<DetectionsView />} />
            <Route path="coverage" element={<CoverageView />} />
            {/* Permalinks other UMBRASEC repos link to. Public contract: keep these paths stable. */}
            <Route path="skills" element={<Navigate to="/detections?tab=skills" replace />} />
            <Route path="skills/:name" element={<SkillView />} />
            {/* Splat so T1558/003 resolves as well as T1558.003. */}
            <Route path="attack/*" element={<AttackView />} />
            <Route path="events" element={<EventsView />} />
            <Route path="tools" element={<ToolsView />} />
            <Route path="sections/:sectionId" element={<SectionView />} />
            <Route path="about" element={<AboutView />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MotionConfig>
    </BrowserRouter>
  );
}
