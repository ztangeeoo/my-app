-- ===== Supabase 数据库表结构 =====
-- 在 Supabase Dashboard → SQL Editor 中执行

-- 用户配置表（在 Supabase Auth 用户基础上扩展）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 简单笔记表（演示 CRUD）
CREATE TABLE IF NOT EXISTS public.notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS（行级安全）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "用户可查看公开资料"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "用户可修改自己的资料"
  ON public.profiles FOR ALL
  USING (auth.uid() = id);

-- Notes 策略
CREATE POLICY "用户可查看自己的笔记和公开笔记"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "用户可增删改自己的笔记"
  ON public.notes FOR ALL
  USING (auth.uid() = user_id);

-- 触发器：新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
