-- ===== Supabase 数据库表结构（完整版）=====

-- 用户配置表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 笔记表
CREATE TABLE IF NOT EXISTS public.notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 新增：需求信号表 =====
CREATE TABLE IF NOT EXISTS public.demand_signals (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  subreddit TEXT,
  source TEXT DEFAULT 'reddit',
  content TEXT,
  score INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  demand_score INTEGER DEFAULT 0,
  
  -- DeepSeek 分析字段
  demand_type TEXT,          -- tool/service/platform/feature
  target_audience TEXT,
  core_need TEXT,
  pain_level INTEGER,
  monetize_potential INTEGER,
  keywords TEXT[],           -- 标签数组
  summary TEXT,
  
  -- 元信息
  status TEXT DEFAULT 'new',  -- new/viewed/archived
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== RLS =====
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "公开资料可读" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "用户可改自己资料" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Notes 策略
CREATE POLICY "笔记可读" ON public.notes FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "笔记可写" ON public.notes FOR ALL USING (auth.uid() = user_id);

-- Demand Signals 策略（公开可读，仅 service_role 可写）
CREATE POLICY "需求信号公开可读" ON public.demand_signals FOR SELECT USING (true);
CREATE POLICY "service_role可写" ON public.demand_signals FOR ALL USING (true);

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_demand_score ON public.demand_signals(demand_score DESC);
CREATE INDEX IF NOT EXISTS idx_demand_created ON public.demand_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_type ON public.demand_signals(demand_type);
CREATE INDEX IF NOT EXISTS idx_demand_status ON public.demand_signals(status);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_demand_signals_updated
  BEFORE UPDATE ON public.demand_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 注册自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
