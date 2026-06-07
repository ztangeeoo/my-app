import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Radar from './pages/Radar'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('notes')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="page-center"><p>加载中...</p></div>

  if (!session) return <Login />

  return (
    <div>
      {/* 导航栏 */}
      <nav className="nav-bar">
        <button
          className={page === 'notes' ? 'nav-active' : ''}
          onClick={() => setPage('notes')}
        >
          📝 笔记
        </button>
        <button
          className={page === 'radar' ? 'nav-active' : ''}
          onClick={() => setPage('radar')}
        >
          📡 需求雷达
        </button>
        <span className="nav-user">{session.user.email}</span>
      </nav>

      {page === 'notes' ? <Dashboard session={session} /> : <Radar session={session} />}
    </div>
  )
}
