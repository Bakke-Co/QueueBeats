-- QueueBeats database baseline: an EMPTY restart, not a restoration.
--
-- The original project (thuqfmfgpodaxxvydbcz) was deleted by the provider; no data export was
-- found (PLANS/QUEUEBEATS_DATABASE_RECOVERY_20261103.md in the fleet workspace). This file
-- recreates the schema the frontend reads and writes, on a free-tier project
-- (tkynafomqenuuzqfeems, org llulkszeaubcnupzyibl, 0 kr), authorised by David's DM
-- 4240b21cd09bb6e58a1eb21a11fb68f2ef5369e50dbe62d63065213ca2fc5f51 (05.11.2026).
--
-- Reconciled from supabase-schema.sql, user-settings-setup.sql and
-- 20231207000000_create_spotify_tokens_table.sql, against frontend/src/utils/database.types.ts:
--   · spotify_tokens follows the 2023 migration (expires_at BIGINT, UNIQUE user_id), which is what
--     spotify.ts upserts with onConflict 'user_id'. spotify_tokens_setup.sql (timestamptz,
--     token_type NOT NULL, no unique key) would reject that upsert and is superseded.
--   · Security fixed, not copied: a queue's creator_id and a song's added_by must be auth.uid().
--     The legacy policies checked only that someone was signed in, so any user could create a
--     queue or a song in another user's name.
--   · SECURITY DEFINER functions pin search_path.
--   · songs and votes join the supabase_realtime publication (frontend/src/utils/realtime.ts).
--
-- Chose: one versioned baseline.  Over: running the legacy setup scripts in some order.
-- Because: they overlap and disagree (two spotify_tokens shapes).  Revisit if: an export of the
-- old data appears (then restore into an isolated project and reconcile IDs before any cutover).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  username text,
  full_name text,
  avatar_url text,
  website text,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

CREATE TABLE public.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  creator_id uuid NOT NULL REFERENCES public.profiles (id),
  active boolean DEFAULT true,
  access_code text,
  settings jsonb
);

CREATE TABLE public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  queue_id uuid NOT NULL REFERENCES public.queues (id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  duration integer,
  added_by uuid NOT NULL REFERENCES public.profiles (id),
  track_uri text,
  cover_url text,
  played boolean DEFAULT false,
  played_at timestamptz,
  position integer
);

CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  song_id uuid NOT NULL REFERENCES public.songs (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  vote_count integer DEFAULT 1,
  UNIQUE (song_id, profile_id)
);

CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  spotify_access_token text,
  spotify_refresh_token text,
  spotify_token_expires_at timestamptz,
  settings jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.spotify_tokens (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

CREATE INDEX idx_profiles_username ON public.profiles (username);
CREATE INDEX idx_queues_creator_id ON public.queues (creator_id);
CREATE INDEX idx_songs_queue_id ON public.songs (queue_id);
CREATE INDEX idx_songs_added_by ON public.songs (added_by);
CREATE INDEX idx_votes_song_id ON public.votes (song_id);
CREATE INDEX idx_votes_profile_id ON public.votes (profile_id);

-- updated_at
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_spotify_tokens_updated_at BEFORE UPDATE ON public.spotify_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A profile and a settings row for every new account.
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    coalesce(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row level security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotify_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY queues_select ON public.queues FOR SELECT USING (true);
CREATE POLICY queues_insert_own ON public.queues FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = creator_id);
CREATE POLICY queues_update_own ON public.queues FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = creator_id) WITH CHECK ((SELECT auth.uid()) = creator_id);
CREATE POLICY queues_delete_own ON public.queues FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = creator_id);

CREATE POLICY songs_select ON public.songs FOR SELECT USING (true);
CREATE POLICY songs_insert_own ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = added_by
    AND EXISTS (SELECT 1 FROM public.queues q WHERE q.id = queue_id AND q.active IS NOT FALSE)
  );
CREATE POLICY songs_update_queue_creator ON public.songs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.queues q WHERE q.id = queue_id AND q.creator_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.queues q WHERE q.id = queue_id AND q.creator_id = (SELECT auth.uid())));
CREATE POLICY songs_delete_queue_creator ON public.songs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.queues q WHERE q.id = queue_id AND q.creator_id = (SELECT auth.uid())));

CREATE POLICY votes_select ON public.votes FOR SELECT USING (true);
CREATE POLICY votes_insert_own ON public.votes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY votes_update_own ON public.votes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = profile_id) WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY votes_delete_own ON public.votes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY user_settings_own ON public.user_settings FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY spotify_tokens_own ON public.spotify_tokens FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.songs, public.votes;
