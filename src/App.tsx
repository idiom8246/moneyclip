import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { Breadcrumbs } from './components/Breadcrumbs'
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
import { InventoryListPage } from './pages/InventoryListPage'
import { InventoryItemPage } from './pages/InventoryItemPage'

export default function App() {
  return (
    <HashRouter>
      <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col pt-[env(safe-area-inset-top)] text-ink dark:text-dusk-ink">
        <OfflineBanner />
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto pb-36">
          <Breadcrumbs />
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="/invoices" element={<CollectionPage invoicesOnly />} />
            <Route path="/saved" element={<CollectionPage mode="saved" />} />
            <Route path="/add" element={<RecordFormPage />} />
            <Route path="/record/:id" element={<RecordDetailPage />} />
            <Route path="/record/:id/edit" element={<RecordFormPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/product/:key" element={<DossierPage />} />
            <Route path="/store/:name" element={<StorePage />} />
            <Route path="/trip/:tag" element={<TripPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/inventory" element={<InventoryListPage />} />
            <Route path="/inventory/:id" element={<InventoryItemPage />} />
            {/* Legacy /list deep links now land on the 庫存 page's segmented toggle. */}
            <Route path="/list" element={<Navigate to="/inventory?tab=list" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  )
}
