// Reddit 闇€姹傚彂鐜伴浄杈?- Supabase 鐗?// 閫氳繃 service_role key 鐩村啓 Supabase锛岄渶瑕?VPN/浠ｇ悊鎵嶈兘璁块棶 Reddit
// 濡傛灉 Reddit 涓嶅彲杈撅紝浼氳嚜鍔ㄥ垏鎹㈠浗鍐呮暟鎹簮

// Supabase 閰嶇疆锛堜紭鍏堣鐜鍙橀噺锛屽厹搴曠敤纭紪鐮侊級
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://boxolazpjqqygsbdupgs.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveG9sYXpwanFxeWdzYmR1cGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgwOTIxOSwiZXhwIjoyMDk2Mzg1MjE5fQ.jGLeFlWiDD0uw_J4ZlNlyRM17UbZueEAK13kXE5gF6Y';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-fc3671d78969454e8430e6d1129c7293';

console.log('馃敡 閰嶇疆:');
console.log('   SUPABASE_URL:', SUPABASE_URL);
console.log('   DEEPSEEK_KEY 鍓嶇紑:', DEEPSEEK_KEY.substring(0, 10) + '...');
console.log('   SUPABASE_SERVICE_KEY 鍓嶇紑:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

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

// ===== Supabase 瀛樺偍 =====
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

// ===== Reddit 鎶撳彇锛堝鏂瑰紡锛?=====
async async function fetchPosts(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25&raw_json=1`;
  
  // 方式1: curl 直连
  try {
    const { execSync } = await import('child_process');
    const out = execSync(`curl -sL --connect-timeout 8 --max-time 15 "${url}" -H "User-Agent: Mozilla/5.0 (compatible; DemandRadar/1.0)"`, 
      { encoding: 'utf-8', timeout: 20000 });
    const data = JSON.parse(out);
    if (data?.data?.children?.length > 0) return parseChildren(data.data.children, subreddit);
  } catch {}
  
  // 方式2: curl 通过代理
  try {
    const { execSync } = await import('child_process');
    const proxyUrl = url.replace('https://www.reddit.com', 'https://ghproxy.net/https://www.reddit.com');
    const out = execSync(`curl -sL --connect-timeout 8 --max-time 20 "${proxyUrl}"`, 
      { encoding: 'utf-8', timeout: 25000 });
    const data = JSON.parse(out);
    if (data?.data?.children?.length > 0) return parseChildren(data.data.children, subreddit);
  } catch {}
  
  // 方式3: fetch 兜底
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DemandRadar/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.data?.children?.length > 0) return parseChildren(data.data.children, subreddit);
    }
  } catch {}
  return [];
}

function parseChildren(children, subreddit) {
  return children.filter(c => c.kind === 't3').map(c => ({
    id: c.data.id, title: c.data.title,
    text: (c.data.selftext || '').substring(0, 500),
    url: `https://reddit.com${c.data.permalink}`,
    subreddit, score: c.data.score, comments: c.data.num_comments,
  }));
}
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

// ===== DeepSeek 娣卞叆鍒嗘瀽 =====
async function analyzeWithDeepSeek(post) {
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{
          role: 'system',
          content: `鍒嗘瀽 Reddit 甯栧瓙涓殑闇€姹備俊鍙枫€傝緭鍑篔SON:
{
  "demandType": "tool/service/platform/feature/unknown",
  "targetAudience": "涓€鍙ヨ瘽",
  "coreNeed": "鏍稿績闇€姹?,
  "painLevel": 1-5,
  "monetizePotential": 1-5,
  "keywords": ["鏍囩1"],
  "summary": "涓€鍙ヨ瘽鎬荤粨闇€姹傛満浼?
}`
        }, {
          role: 'user',
          content: `r/${post.subreddit}\n鏍囬: ${post.title}\n甯栧瓙: ${(post.text || '').substring(0, 1000)}\n馃憤${post.score} 馃挰${post.comments}`
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

// ===== 涓绘祦绋?=====
async function main() {
  console.log('📡 雷达开始运行...');
  console.log('馃攧 Reddit 闇€姹傞浄杈惧惎鍔?..');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   鐩戞帶: ${CONFIG.subreddits.length} 涓瓙鐗堝潡\n`);

  let total = 0;

  for (let i = 0; i < CONFIG.subreddits.length; i++) {
    const sub = CONFIG.subreddits[i];
    process.stdout.write(`  [${i+1}/${CONFIG.subreddits.length}] r/${sub}... `);
    
    const posts = await fetchPosts(sub);
    if (posts.length === 0) { console.log('鈴?璺宠繃'); continue; }
    
    process.stdout.write(`(${posts.length}鏉? `);

    for (const post of posts) {
      const analysis = scorePost(post);
      if (analysis.score <= 0) continue;
      
      const deep = await analyzeWithDeepSeek(post);
      const ok = await saveToSupabase(post, analysis, deep);
      if (ok) total++;
      process.stdout.write(deep ? '馃' : '.');
    }
    console.log();
  }

  console.log(`\n馃搳 瀹屾垚锛佸瓨鍏?${total} 鏉￠渶姹備俊鍙峰埌 Supabase`);
  console.log(`   馃搧 鏌ョ湅: ${SUPABASE_URL}/rest/v1/demand_signals?select=title,demand_score,subreddit&order=demand_score.desc&limit=50`);
  console.log(`   馃枼锔?鍓嶇: https://ztangeeoo.github.io/my-app/`);
}

main().catch(console.error);



