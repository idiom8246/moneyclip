import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { OfflineBanner } from './components/OfflineBanner'
import { CollectionPage } from './pages/CollectionPage'
import { RecordFormPage } from './pages/RecordFormPage'
import { RecordDetailPage } from './pages/RecordDetailPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto flex h-full max-w-md flex-col bg-paper text-ink dark:bg-dusk dark:text-dusk-ink">
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto pb-24">
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="/add" element={<RecordFormPage />} />
            <Route path="/record/:id" element={<RecordDetailPage />} />
            <Route path="/record/:id/edit" element={<RecordFormPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
