import pg from 'pg'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const REF = 'boxolazpjqqygsbdupgs'

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 请设置 SERVICE_ROLE_KEY')
  process.exit(1)
}

const sql = fs.readFileSync(join(rootDir, 'supabase/schema.sql'), 'utf-8')

// 尝试不同用户格式
const configs = [
  { user: 'postgres', host: `db.${REF}.supabase.co`, port: 5432, label: 'postgres@direct' },
  { user: `postgres.${REF}`, host: `db.${REF}.supabase.co`, port: 5432, label: 'postgres.ref@direct' },
  { user: 'postgres', host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543, label: 'postgres@sg-tx' },
  { user: 'postgres', host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 5432, label: 'postgres@sg-sess' },
]

let pool = null

for (const c of configs) {
  console.log(`🔄 尝试 ${c.label} (${c.user}@${c.host}:${c.port})...`)
  const p = new pg.Pool({
    user: c.user,
    password: SERVICE_ROLE_KEY,
    host: c.host,
    port: c.port,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 8000,
  })
  try {
    const client = await p.connect()
    await client.query('SELECT 1 AS ok')
    client.release()
    console.log(`  ✅ 成功！`)
    pool = p
    break
  } catch (err) {
    console.log(`  ❌ ${err.message.substring(0, 90)}`)
    await p.end()
  }
}

if (!pool) {
  console.log('\n❌ 所有方式都连不上。请在 Supabase Dashboard → SQL Editor 手动执行 SQL。')
  process.exit(1)
}

console.log('\n🔄 执行 schema.sql...')
try {
  const client = await pool.connect()
  await client.query(sql)
  console.log('✅ SQL 执行成功！')

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  )
  console.log('📋 表:', rows.map(r => r.table_name).join(', '))

  client.release()
  console.log('\n🎉 完成！')
} catch (err) {
  console.error('❌ SQL 失败:', err.message)
} finally {
  await pool.end()
}
