-- ==========================================
-- ECAMPUS FULL DATABASE SCHEMA
-- ==========================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. BASE TABLES
-- ==========================================

-- Colleges Table
CREATE TABLE IF NOT EXISTS public.colleges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT colleges_pkey PRIMARY KEY (id)
);

-- Users Table (Public Profile)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid,
  student_id character varying(20) NOT NULL,
  full_name text NOT NULL,
  course text,
  email text NOT NULL UNIQUE,
  mobile text,
  gender text,
  profile_img_url text DEFAULT 'https://ui-avatars.com/api/?name=User&background=e1e3e4',
  tick_type text DEFAULT 'none', -- 'blue', 'gold', 'green', 'gray', 'none'
  role text DEFAULT 'student',
  is_volunteer boolean DEFAULT false,
  special_post boolean DEFAULT false, -- Permission for rich media posts
  connection_count integer DEFAULT 0,
  created_by uuid,
  college text,
  bio text DEFAULT '',
  social_links jsonb DEFAULT '[]'::jsonb,
  is_private boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Connections Table
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_one_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_two_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
  action_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connections_pkey PRIMARY KEY (id),
  CONSTRAINT connections_check_users_different CHECK (user_one_id != user_two_id)
);

-- ==========================================
-- 2. POSTS & INTERACTIONS
-- ==========================================

-- Advanced Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_type text NOT NULL DEFAULT 'text', -- 'text', 'image', 'poll', 'event'
  content text NOT NULL,
  media_url text,
  
  -- Event specific columns
  event_image_url text,
  event_date timestamp with time zone,
  event_location text,
  event_register_url text,
  
  -- Poll specific columns
  poll_options jsonb, -- e.g. '["Option A", "Option B"]'
  poll_is_anon boolean DEFAULT false,
  poll_is_multiple_choice boolean DEFAULT false,
  poll_expires_at timestamp with time zone,
  
  -- Flags
  is_verified boolean DEFAULT false,
  is_deleted boolean DEFAULT false, -- Soft delete flag
  
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT posts_pkey PRIMARY KEY (id)
);

-- Post Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_unique_like UNIQUE (post_id, user_id)
);

-- Post Comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean DEFAULT false, -- Soft delete flag
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_comments_pkey PRIMARY KEY (id)
);

-- Post Poll Votes (Supports multiple choice per user)
CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT post_poll_votes_unique_user_option UNIQUE (post_id, user_id, option_index)
);

-- ==========================================
-- 3. REPORTS & MODERATION
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  reported_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_check_target CHECK (reported_user_id IS NOT NULL OR reported_post_id IS NOT NULL)
);

-- ==========================================
-- 4. HELPER FUNCTIONS & TRIGGERS
-- ==========================================

-- Secure helper to get the public.users ID for the current authenticated user
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- Secure helper to check if two users are blocked
CREATE OR REPLACE FUNCTION public.is_blocked(user1 uuid, user2 uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.connections
    WHERE status = 'blocked'
    AND (
      (user_one_id = user1 AND user_two_id = user2) OR
      (user_one_id = user2 AND user_two_id = user1)
    )
  );
END;
$$;

-- RPC to report a post safely (prevents reporting official verified posts)
CREATE OR REPLACE FUNCTION public.report_post(p_reported_post_id uuid, p_reason text, p_description text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_is_verified boolean;
BEGIN
  SELECT is_verified INTO v_is_verified FROM public.posts WHERE id = p_reported_post_id;
  IF v_is_verified THEN
    RAISE EXCEPTION 'Verified posts cannot be reported.';
  END IF;

  INSERT INTO public.reports(reporter_id, reported_post_id, reason, description)
  VALUES (public.current_user_id(), p_reported_post_id, p_reason, p_description);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Trigger: Set updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_users_updated_at ON public.users;
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_connections_updated_at ON public.connections;
CREATE TRIGGER handle_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: Maintain user connection counts
CREATE OR REPLACE FUNCTION public.update_connection_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE public.users SET connection_count = connection_count + 1 WHERE id IN (NEW.user_one_id, NEW.user_two_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    UPDATE public.users SET connection_count = connection_count + 1 WHERE id IN (NEW.user_one_id, NEW.user_two_id);
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'accepted') OR (TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status != 'accepted') THEN
    UPDATE public.users SET connection_count = connection_count - 1 WHERE id IN (OLD.user_one_id, OLD.user_two_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_change ON public.connections;
CREATE TRIGGER on_connection_change
  AFTER INSERT OR UPDATE OR DELETE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.update_connection_counts();

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth_user_id = auth.uid());

-- Connections
CREATE POLICY "Users can view their own connections" ON public.connections FOR SELECT USING (user_one_id = public.current_user_id() OR user_two_id = public.current_user_id());
CREATE POLICY "Users can insert connections" ON public.connections FOR INSERT WITH CHECK (action_user_id = public.current_user_id());
CREATE POLICY "Users can update connections" ON public.connections FOR UPDATE USING (user_one_id = public.current_user_id() OR user_two_id = public.current_user_id());

-- Posts (HIDE DELETED & BLOCKED)
CREATE POLICY "Read posts" ON public.posts FOR SELECT USING (
  is_deleted = false AND NOT public.is_blocked(public.current_user_id(), user_id)
);
CREATE POLICY "Insert posts" ON public.posts FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Update own posts (Soft Delete)" ON public.posts FOR UPDATE USING (user_id = public.current_user_id());

-- Likes
CREATE POLICY "Read likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Insert likes" ON public.post_likes FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Delete likes" ON public.post_likes FOR DELETE USING (user_id = public.current_user_id());

-- Comments (HIDE DELETED)
CREATE POLICY "Read comments" ON public.post_comments FOR SELECT USING (is_deleted = false);
CREATE POLICY "Insert comments" ON public.post_comments FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Update comments (Soft Delete)" ON public.post_comments FOR UPDATE USING (user_id = public.current_user_id());

-- Poll Votes
CREATE POLICY "Read poll votes" ON public.post_poll_votes FOR SELECT USING (true);
CREATE POLICY "Insert poll votes" ON public.post_poll_votes FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Delete poll votes" ON public.post_poll_votes FOR DELETE USING (user_id = public.current_user_id());

-- Reports
CREATE POLICY "Insert reports" ON public.reports FOR INSERT WITH CHECK (reporter_id = public.current_user_id());

-- ==========================================
-- 6. INDEXES FOR PERFORMANCE
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS connections_unique_pair_idx ON public.connections (least(user_one_id, user_two_id), greatest(user_one_id, user_two_id));
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.post_comments(post_id);
