import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard({ session }) {
  const [notes, setNotes] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes() {
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
    setLoading(false)
  }

  async function addNote(e) {
    e.preventDefault()
    if (!title.trim()) return
    const { data } = await supabase
      .from('notes')
      .insert({ title, content, user_id: session.user.id })
      .select()
    if (data) {
      setNotes([data[0], ...notes])
      setTitle('')
      setContent('')
    }
  }

  async function deleteNote(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(notes.filter(n => n.id !== id))
  }

  return (
    <div className="page">
      <header className="header">
        <h1>📝 我的笔记</h1>
        <div>
          <span className="user-badge">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline">
            退出
          </button>
        </div>
      </header>

      <form onSubmit={addNote} className="note-form">
        <input
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="内容（可选）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <button type="submit">添加笔记</button>
      </form>

      {loading ? (
        <p className="loading">加载中...</p>
      ) : notes.length === 0 ? (
        <p className="empty">还没有笔记，写一条吧 ✍️</p>
      ) : (
        <div className="notes-list">
          {notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <h3>{note.title}</h3>
                <button onClick={() => deleteNote(note.id)} className="btn-small">
                  ✕
                </button>
              </div>
              {note.content && <p>{note.content}</p>}
              <span className="note-date">
                {new Date(note.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      )}

      <footer className="footer">
        🦐 Powered by GitHub Pages + Supabase
      </footer>
    </div>
  )
}
