import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <div className="flex flex-col w-full relative">
        <AppHeader />
        <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-in-up">
          <div className="w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
