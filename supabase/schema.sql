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
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  student_id character varying NOT NULL UNIQUE,
  full_name text NOT NULL,
  course text,
  email text NOT NULL UNIQUE,
  mobile text,
  gender text,
  college text,
  profile_img_url text DEFAULT 'https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg'::text,
  tick_type text DEFAULT 'blue'::text,
  role text DEFAULT 'student'::text,
  is_volunteer boolean DEFAULT false,
  bio text DEFAULT 'Passionate about sustainability... 🌱',
  social_links jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);


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

-- -------------------------
-- POLICIES FOR 'users' TABLE
-- -------------------------
-- Read all profiles (needed for discover/hotposts feeds)
CREATE POLICY "Users can read all profiles" 
ON public.users FOR SELECT TO authenticated 
USING (true);

-- Update own profile
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE TO authenticated 
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Insert own profile
CREATE POLICY "Users can insert their own profile" 
ON public.users FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = auth_user_id);


-- -------------------------
-- POLICIES FOR 'colleges' TABLE
-- -------------------------
CREATE POLICY "Allow public read access on colleges" 
ON public.colleges FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access on colleges" 
ON public.colleges FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access on colleges" 
ON public.colleges FOR UPDATE 
USING (true);
