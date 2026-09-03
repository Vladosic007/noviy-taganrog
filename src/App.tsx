import { Routes, Route, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { MapScreen } from './screens/MapScreen';
import { ListScreen } from './screens/ListScreen';
import { MyReportsScreen } from './screens/MyReportsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ReportScreen } from './screens/ReportScreen';
import { ProblemScreen } from './screens/ProblemScreen';
import { ModerationScreen } from './screens/ModerationScreen';
import { LegalScreen } from './screens/LegalScreen';

// Фокус-экран: та же колонка 480px, но без нижней навигации (одно действие на экран).
function FocusLayout() {
  return (
    <div className="app-layout">
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<MapScreen />} />
        <Route path="/list" element={<ListScreen />} />
        <Route path="/my" element={<MyReportsScreen />} />
        <Route path="/moderation" element={<ModerationScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Route>
      <Route element={<FocusLayout />}>
        <Route path="/report" element={<ReportScreen />} />
        <Route path="/problem/:id" element={<ProblemScreen />} />
        <Route path="/legal/:slug" element={<LegalScreen />} />
      </Route>
    </Routes>
  );
}
