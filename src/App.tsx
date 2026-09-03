import { HashRouter, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { OfflineBanner } from './components/OfflineBanner'
import { CollectionPage } from './pages/CollectionPage'
import { RecordFormPage } from './pages/RecordFormPage'
import { RecordDetailPage } from './pages/RecordDetailPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { DossierPage } from './pages/DossierPage'
import { StorePage } from './pages/StorePage'
import { TripPage } from './pages/TripPage'
import { ReportsPage } from './pages/ReportsPage'

export default function App() {
  return (
    <HashRouter>
      <div className="mx-auto flex h-full max-w-md flex-col bg-paper pt-[env(safe-area-inset-top)] text-ink dark:bg-dusk dark:text-dusk-ink">
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto pb-32">
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="/add" element={<RecordFormPage />} />
            <Route path="/record/:id" element={<RecordDetailPage />} />
            <Route path="/record/:id/edit" element={<RecordFormPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/product/:key" element={<DossierPage />} />
            <Route path="/store/:name" element={<StorePage />} />
            <Route path="/trip/:tag" element={<TripPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  )
}
