import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Radar({ session }) {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({})

  useEffect(() => {
    loadSignals()
  }, [])

  async function loadSignals() {
    setLoading(true)

    // 统计
    const { data: statsData } = await supabase
      .rpc('get_demand_stats')
      .single()
      .catch(() => null)
    
    if (statsData) setStats(statsData)

    let query = supabase
      .from('demand_signals')
      .select('*')
      .order('demand_score', { ascending: false })
      .limit(50)

    if (filter === 'high') query = query.gte('demand_score', 4)
    else if (filter === 'new') query = query.eq('status', 'new')

    const { data } = await query
    if (data) setSignals(data)
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('demand_signals').update({ status }).eq('id', id)
    setSignals(signals.map(s => s.id === id ? { ...s, status } : s))
  }

  // 分数颜色
  function scoreColor(score) {
    if (score >= 5) return '#ef4444'
    if (score >= 3) return '#f59e0b'
    return '#6b7280'
  }

  return (
    <div className="radar-page">
      <header className="header">
        <div>
          <h1>📡 需求发现雷达</h1>
          <p className="subtitle">监控 Reddit 子版块，AI 自动识别需求信号</p>
        </div>
        <div className="header-actions">
          <span className="user-badge">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline">退出</button>
        </div>
      </header>

      {/* 统计卡片 */}
      <div className="stats-row">
        <div className="stat-card highlight">🔥 高价值<br/><strong>{stats.high_value || 0}</strong></div>
        <div className="stat-card">📊 总数<br/><strong>{stats.total || 0}</strong></div>
        <div className="stat-card">🆕 新增<br/><strong>{stats.unread || 0}</strong></div>
        <div className="stat-card">🏷️ 类型<br/><strong>{stats.type_count || 0}</strong></div>
      </div>

      {/* 筛选 */}
      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')}>🔥 高价值</button>
        <button className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}>🆕 未读</button>
        <button className="btn-reload" onClick={loadSignals}>🔄 刷新</button>
      </div>

      {/* 列表 */}
      {loading ? (
        <p className="loading">加载中...</p>
      ) : signals.length === 0 ? (
        <p className="empty">暂无数据，雷达正在运转中...</p>
      ) : (
        <div className="signal-list">
          {signals.map(s => (
            <div key={s.id} className={`signal-card ${s.status === 'viewed' ? 'viewed' : ''}`}>
              <div className="signal-score" style={{ background: scoreColor(s.demand_score) }}>
                {s.demand_score}
              </div>
              
              <div className="signal-body">
                <div className="signal-header">
                  <span className="signal-sub">r/{s.subreddit}</span>
                  {s.demand_type && <span className="signal-type">{s.demand_type}</span>}
                </div>
                
                <h3 className="signal-title">{s.title}</h3>
                
                {s.core_need && (
                  <p className="signal-need">🎯 {s.core_need}</p>
                )}
                
                {s.target_audience && (
                  <p className="signal-audience">👥 {s.target_audience}</p>
                )}
                
                {s.summary && (
                  <p className="signal-summary">{s.summary}</p>
                )}

                <div className="signal-meta">
                  <span>👍 {s.score}</span>
                  <span>💬 {s.comments_count}</span>
                  {s.monetize_potential && <span>💰 {'⭐'.repeat(s.monetize_potential)}</span>}
                  {s.pain_level && <span>😖 {'🔥'.repeat(s.pain_level)}</span>}
                </div>

                {s.keywords?.length > 0 && (
                  <div className="signal-tags">
                    {s.keywords.map((kw, i) => (
                      <span key={i} className="tag">{kw}</span>
                    ))}
                  </div>
                )}

                <div className="signal-actions">
                  <a href={s.url} target="_blank" className="btn-link">🔗 原文</a>
                  {s.status === 'new' && (
                    <button onClick={() => updateStatus(s.id, 'viewed')} className="btn-small">已读</button>
                  )}
                  {s.status !== 'archived' && (
                    <button onClick={() => updateStatus(s.id, 'archived')} className="btn-small btn-archive">归档</button>
                  )}
                </div>

                <div className="signal-date">
                  {new Date(s.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="footer">
        🦐 需求雷达 v1.0 | 数据来源: Reddit + DeepSeek AI 分析
      </footer>
    </div>
  )
}
