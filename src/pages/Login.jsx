import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: email.split('@')[0] } }
    })
    if (error) {
      setMsg(error.message)
    } else {
      setMsg('注册成功！请查收验证邮件（如果开启了邮箱验证）')
    }
    setLoading(false)
  }

  return (
    <div className="page-center">
      <div className="card">
        <h1>🦐 My App</h1>
        <p className="subtitle">GitHub + Supabase 全栈模板</p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="密码（至少6位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <div className="btn-group">
            <button type="submit" disabled={loading}>
              {loading ? '处理中...' : '登录'}
            </button>
            <button type="button" onClick={handleSignUp} disabled={loading} className="btn-secondary">
              注册
            </button>
          </div>
        </form>

        {msg && <p className="msg">{msg}</p>}

        <details className="setup-tip">
          <summary>首次使用？点我查看配置步骤</summary>
          <ol>
            <li>去 <code>supabase.com</code> 注册 → 创建项目</li>
            <li>在 SQL Editor 执行 <code>supabase/schema.sql</code></li>
            <li>在 Settings → API 复制 URL 和 anon key</li>
            <li>在项目根目录创建 <code>.env</code> 文件填入配置</li>
          </ol>
        </details>
      </div>
    </div>
  )
}
