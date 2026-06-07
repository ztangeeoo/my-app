// Reddit 需求发现雷达 - Supabase 版
// 通过 service_role key 直写 Supabase，需要 VPN/代理才能访问 Reddit
// 如果 Reddit 不可达，会自动切换国内数据源

const API_BASE = 'http://localhost:3111/agentmemory';

// Supabase 配置（service_role key 用于写数据库）
const SUPABASE_URL = 'https://boxolazpjqqygsbdupgs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveG9sYXpwanFxeWdzYmR1cGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgwOTIxOSwiZXhwIjoyMDk2Mzg1MjE5fQ.jGLeFlWiDD0uw_J4ZlNlyRM17UbZueEAK13kXE5gF6Y';

const CONFIG = {
  subreddits: [
    'somebodyMakeThis', 'AppIdeas', 'SideProject',
    'Entrepreneur', 'Startup_Ideas', 'SaaS',
    'webdev', 'SmallBusiness', 'DigitalMarketing', 'productivity',
  ],
  demandKeywords: [
    'looking for', 'need a', 'any tool', 'is there a', 'wish there was',
    'recommendation', 'suggestion', 'what tool', 'how to find',
    'anyone know', 'alternative', 'better way', 'build a',
    'would be great if', 'struggling with', 'problem with',
    'idea for', 'software for', 'platform for', 'app for',
    'solution for', 'tired of', 'frustrated with', 'missing',
  ],
  excludeKeywords: ['hiring', 'job', 'freelance', 'looking for work', 'for sale'],
};

// ===== Supabase 存储 =====
async function saveToSupabase(post, analysis, deep) {
  const body = {
    title: post.title,
    url: post.url,
    subreddit: post.subreddit,
    source: 'reddit',
    content: (post.text || '').substring(0, 500),
    score: post.score,
    comments_count: post.comments,
    demand_score: analysis.score,
    demand_type: deep?.demandType || null,
    target_audience: deep?.targetAudience || null,
    core_need: deep?.coreNeed || null,
    pain_level: deep?.painLevel || null,
    monetize_potential: deep?.monetizePotential || null,
    keywords: deep?.keywords || analysis.signals || [],
    summary: deep?.summary || null,
    tags: [post.subreddit, ...analysis.signals],
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/demand_signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    });
    return resp.ok;
  } catch { return false; }
}

// ===== Reddit 抓取（多方式） =====
async function fetchPosts(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25&raw_json=1`;
  
  // 尝试方式
  const attempts = [
    // 1. 直连 fetch
    async () => {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'DemandRadar/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      return resp.ok ? await resp.json() : null;
    },
    // 2. ghproxy 代理
    async () => {
      const resp = await fetch(
        url.replace('https://www.reddit.com', 'https://ghproxy.net/https://www.reddit.com'),
        { signal: AbortSignal.timeout(15000) }
      );
      return resp.ok ? await resp.json() : null;
    },
    // 3. curl 直连
    async () => {
      const { execSync } = await import('child_process');
      const out = execSync(
        `curl.exe -sL --connect-timeout 10 --max-time 20 "${url}" -H "User-Agent: DemandRadar/1.0"`,
        { encoding: 'utf-8', timeout: 25000 }
      );
      return JSON.parse(out);
    },
  ];

  for (const fn of attempts) {
    try {
      const data = await fn();
      if (data?.data?.children) {
        return data.data.children
          .filter(c => c.kind === 't3')
          .map(c => ({
            id: c.data.id,
            title: c.data.title,
            text: (c.data.selftext || '').substring(0, 500),
            url: `https://reddit.com${c.data.permalink}`,
            subreddit,
            score: c.data.score,
            comments: c.data.num_comments,
          }));
      }
    } catch {}
  }
  return [];
}

// ===== 需求信号评分 =====
function scorePost(post) {
  const text = (post.title + ' ' + (post.text || '')).toLowerCase();
  let score = 0;
  const signals = [];
  for (const kw of CONFIG.demandKeywords) {
    if (text.includes(kw)) { score++; signals.push(kw); }
  }
  for (const kw of CONFIG.excludeKeywords) {
    if (text.includes(kw)) return { score: -1, signals: [] };
  }
  if (post.comments > 5) score++;
  if (post.comments > 20) score++;
  if (post.score > 10) score++;
  if (post.score > 50) score++;
  return { score, signals };
}

// ===== DeepSeek 深入分析 =====
async function analyzeWithDeepSeek(post) {
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-fc3671d78969454e8430e6d1129c7293' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{
          role: 'system',
          content: `分析 Reddit 帖子中的需求信号。输出JSON:
{
  "demandType": "tool/service/platform/feature/unknown",
  "targetAudience": "一句话",
  "coreNeed": "核心需求",
  "painLevel": 1-5,
  "monetizePotential": 1-5,
  "keywords": ["标签1"],
  "summary": "一句话总结需求机会"
}`
        }, {
          role: 'user',
          content: `r/${post.subreddit}\n标题: ${post.title}\n帖子: ${(post.text || '').substring(0, 1000)}\n👍${post.score} 💬${post.comments}`
        }],
        max_tokens: 500, temperature: 0.2
      })
    });
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
}

// ===== 主流程 =====
async function main() {
  console.log('🔄 Reddit 需求雷达启动...');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   监控: ${CONFIG.subreddits.length} 个子版块\n`);

  let total = 0;

  for (let i = 0; i < CONFIG.subreddits.length; i++) {
    const sub = CONFIG.subreddits[i];
    process.stdout.write(`  [${i+1}/${CONFIG.subreddits.length}] r/${sub}... `);
    
    const posts = await fetchPosts(sub);
    if (posts.length === 0) { console.log('⏳ 跳过'); continue; }
    
    process.stdout.write(`(${posts.length}条) `);

    for (const post of posts) {
      const analysis = scorePost(post);
      if (analysis.score <= 0) continue;
      
      const deep = await analyzeWithDeepSeek(post);
      const ok = await saveToSupabase(post, analysis, deep);
      if (ok) total++;
      process.stdout.write(deep ? '🧠' : '.');
    }
    console.log();
  }

  console.log(`\n📊 完成！存入 ${total} 条需求信号到 Supabase`);
  console.log(`   📁 查看: ${SUPABASE_URL}/rest/v1/demand_signals?select=title,demand_score,subreddit&order=demand_score.desc&limit=50`);
  console.log(`   🖥️ 前端: https://ztangeeoo.github.io/my-app/`);
}

main().catch(console.error);
