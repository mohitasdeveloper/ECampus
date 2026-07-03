-- supabase/schema.sql

-- ==========================================
-- 1. CREATE TABLES
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
  id uuid not null default gen_random_uuid (),
  auth_user_id uuid null,
  student_id character varying(20) not null,
  full_name text NOT NULL,
  course text,
  email text NOT NULL UNIQUE,
  mobile text,
  gender text,
  profile_img_url text null default 'https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg'::text,
  tick_type text null default 'blue'::text,
  role text null default 'student'::text,
  is_volunteer boolean null default false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone DEFAULT now(),
  college text null,
  bio text null default ''::text,
  social_links jsonb null default '[]'::jsonb,
  is_private boolean null default false,
  connection_count integer null default 0,
  constraint users_pkey primary key (id),
  constraint users_auth_user_id_key unique (auth_user_id),
  constraint users_email_key unique (email),
  constraint users_student_id_key unique (student_id),
  CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Posts Table (Main Feed)
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.posts IS 'Main feed posts created by users.';

-- Post Likes Table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT post_likes_unique_like UNIQUE (post_id, user_id)
);

-- Post Comments Table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
  CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Connections Table
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_one_id uuid NOT NULL,
  user_two_id uuid NOT NULL,
  status text NOT NULL, -- 'pending', 'accepted', 'blocked'
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connections_pkey PRIMARY KEY (id),
  CONSTRAINT connections_user_one_id_fkey FOREIGN KEY (user_one_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT connections_user_two_id_fkey FOREIGN KEY (user_two_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT connections_unique_pair UNIQUE (user_one_id, user_two_id)
);

-- Hotposts Table (Stories)
CREATE TABLE IF NOT EXISTS public.hotposts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  media_url text NOT NULL,
  media_type text DEFAULT 'image'::text,
  caption text,
  visibility text DEFAULT 'everyone'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hotposts_pkey PRIMARY KEY (id),
  CONSTRAINT hotposts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.hotposts IS 'Stores temporary, 24-hour "story" like posts.';
COMMENT ON COLUMN public.hotposts.visibility IS 'Can be "everyone" or "connections".';

-- Hotpost Views Table
CREATE TABLE IF NOT EXISTS public.hotpost_views (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  hotpost_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hotpost_views_pkey PRIMARY KEY (id),
  CONSTRAINT hotpost_views_hotpost_id_fkey FOREIGN KEY (hotpost_id) REFERENCES public.hotposts(id) ON DELETE CASCADE,
  CONSTRAINT hotpost_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT hotpost_views_unique_view UNIQUE (hotpost_id, viewer_id)
);

COMMENT ON TABLE public.hotpost_views IS 'Tracks unique user views on each hotpost.';

-- Hotpost Replies Table
CREATE TABLE IF NOT EXISTS public.hotpost_replies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  hotpost_id uuid NOT NULL,
  replier_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hotpost_replies_pkey PRIMARY KEY (id),
  CONSTRAINT hotpost_replies_hotpost_id_fkey FOREIGN KEY (hotpost_id) REFERENCES public.hotposts(id) ON DELETE CASCADE,
  CONSTRAINT hotpost_replies_replier_id_fkey FOREIGN KEY (replier_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT hotpost_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Campus Updates Table
CREATE TABLE IF NOT EXISTS public.campus_updates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text,
  category text NOT NULL,
  author_name text DEFAULT 'Admin Office',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campus_updates_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.campus_updates IS 'Stores official campus-wide updates like events, notices, etc.';
COMMENT ON COLUMN public.campus_updates.category IS 'e.g., Event, Notice, Academic, Holiday';

-- ==========================================
-- 2. AUTH TRIGGER (Syncs Auth to Public Users)
-- ==========================================

-- Create the function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id, 
    student_id, 
    email, 
    full_name, 
    mobile, 
    gender, 
    college,
    course, 
    role, 
    is_volunteer
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'student_id',
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'mobile',
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'college_name',
    NEW.raw_user_meta_data->>'course',
    'student',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on both tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotpost_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotpost_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_updates ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- POLICIES FOR 'users' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
-- Read all profiles (needed for discover/hotposts feeds)
CREATE POLICY "Users can read all profiles" 
ON public.users FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
-- Update own profile
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE TO authenticated 
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
-- Insert own profile
CREATE POLICY "Users can insert their own profile" 
ON public.users FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = auth_user_id);

-- -------------------------
-- POLICIES FOR 'colleges' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Allow public read access on colleges" ON public.colleges;
CREATE POLICY "Allow public read access on colleges" 
ON public.colleges FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public insert access on colleges" ON public.colleges;
CREATE POLICY "Allow public insert access on colleges" 
ON public.colleges FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on colleges" ON public.colleges;
CREATE POLICY "Allow public update access on colleges" 
ON public.colleges FOR UPDATE 
USING (true);

-- -------------------------
-- POLICIES FOR 'posts' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can read all posts" ON public.posts;
CREATE POLICY "Users can read all posts"
ON public.posts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE
TO authenticated
USING ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

-- -------------------------
-- POLICIES FOR 'post_likes' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can view all likes" ON public.post_likes;
CREATE POLICY "Users can view all likes"
ON public.post_likes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own likes" ON public.post_likes;
CREATE POLICY "Users can insert their own likes"
ON public.post_likes FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own likes" ON public.post_likes;
CREATE POLICY "Users can delete their own likes"
ON public.post_likes FOR DELETE
TO authenticated
USING ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

-- -------------------------
-- POLICIES FOR 'post_comments' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can view all comments" ON public.post_comments;
CREATE POLICY "Users can view all comments"
ON public.post_comments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON public.post_comments;
CREATE POLICY "Users can insert their own comments"
ON public.post_comments FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;
CREATE POLICY "Users can delete their own comments"
ON public.post_comments FOR DELETE
TO authenticated
USING ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

-- -------------------------
-- POLICIES FOR 'connections' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
CREATE POLICY "Users can view their own connections"
ON public.connections FOR SELECT
TO authenticated
USING (
  (user_one_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())) OR
  (user_two_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert connection requests" ON public.connections;
CREATE POLICY "Users can insert connection requests"
ON public.connections FOR INSERT
TO authenticated
WITH CHECK ( user_one_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) );

DROP POLICY IF EXISTS "Users can update incoming connection requests" ON public.connections;
CREATE POLICY "Users can update incoming connection requests"
ON public.connections FOR UPDATE
TO authenticated
USING ( user_two_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) );

DROP POLICY IF EXISTS "Users can delete incoming connection requests" ON public.connections;
CREATE POLICY "Users can delete incoming connection requests"
ON public.connections FOR DELETE
TO authenticated
USING ( user_two_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) );

-- -------------------------
-- POLICIES FOR 'hotpost_replies' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can insert replies" ON public.hotpost_replies;
CREATE POLICY "Users can insert replies"
ON public.hotpost_replies FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth_user_id FROM public.users WHERE id = replier_id) = auth.uid() );

DROP POLICY IF EXISTS "Users can view replies to their own hotposts" ON public.hotpost_replies;
CREATE POLICY "Users can view replies to their own hotposts"
ON public.hotpost_replies FOR SELECT
TO authenticated
USING ( author_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) );

-- -------------------------
-- POLICIES FOR 'hotposts' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can insert their own hotposts" ON public.hotposts;
CREATE POLICY "Users can insert their own hotposts"
ON public.hotposts FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can view hotposts based on visibility" ON public.hotposts;
CREATE POLICY "Authenticated users can view hotposts based on visibility"
ON public.hotposts FOR SELECT
TO authenticated
USING (
  visibility = 'everyone'
  OR (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  OR (
    visibility = 'connections' AND EXISTS (
      SELECT 1 FROM connections
      WHERE
        status = 'accepted' AND
        (
          (user_one_id = hotposts.user_id AND user_two_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())) OR
          (user_two_id = hotposts.user_id AND user_one_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can delete their own hotposts" ON public.hotposts;
CREATE POLICY "Users can delete their own hotposts"
ON public.hotposts FOR DELETE
TO authenticated
USING ( (SELECT auth_user_id FROM public.users WHERE id = user_id) = auth.uid() );

-- -------------------------
-- POLICIES FOR 'hotpost_views' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Users can insert their own view records" ON public.hotpost_views;
CREATE POLICY "Users can insert their own view records"
ON public.hotpost_views FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth_user_id FROM public.users WHERE id = viewer_id) = auth.uid()
);

DROP POLICY IF EXISTS "Users can see views on their own hotposts" ON public.hotpost_views;
CREATE POLICY "Users can see views on their own hotposts"
ON public.hotpost_views FOR SELECT
TO authenticated
USING (
  (SELECT user_id FROM public.hotposts WHERE id = hotpost_id) = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- -------------------------
-- POLICIES FOR 'campus_updates' TABLE
-- -------------------------
DROP POLICY IF EXISTS "Authenticated users can read campus updates" ON public.campus_updates;
CREATE POLICY "Authenticated users can read campus updates"
ON public.campus_updates FOR SELECT
TO authenticated
USING (true);
