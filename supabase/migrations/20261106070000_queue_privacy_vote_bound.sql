-- Two holes Pilot found in the baseline (PR #4, 06.11.2026), closed before cutover.
--
-- 1. queues were readable by everyone, so an anonymous visitor could list every queue with its
--    access_code. The app reads a queue three ways only: its creator's own list, by id, by code.
--    Reads now go: own rows through RLS, by id or by code through two SECURITY DEFINER functions.
--    get_queue(id) returns access_code only to the queue's creator; get_queue_by_access_code
--    returns the active queue to whoever already holds its code.
-- 2. votes.vote_count had no bound. The app only ever writes 1 (SongRow.tsx -> voteForSong
--    default), and UNIQUE (song_id, profile_id) gives one row per voter, so 0..1 is the domain.
--
-- songs_insert_own checked queues.active with a subquery that now runs under the caller's RLS
-- and would hide other users' queues: it uses queue_accepts_songs() instead.
--
-- Chose: owner-only RLS plus narrow lookup functions.  Over: column-level REVOKE on access_code
-- (select('*') from the app would then fail for every reader).  Because: no list-all path remains.
-- Revisit if: the app adds a public queue directory (then add an explicit column list function).

ALTER TABLE public.votes ADD CONSTRAINT votes_vote_count_bounded CHECK (vote_count BETWEEN 0 AND 1);

DROP POLICY queues_select ON public.queues;
CREATE POLICY queues_select_own ON public.queues FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = creator_id);

CREATE FUNCTION public.get_queue(p_id uuid) RETURNS SETOF public.queues
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT q.id, q.created_at, q.name, q.description, q.creator_id, q.active,
         CASE WHEN q.creator_id = auth.uid() THEN q.access_code END,
         q.settings
  FROM public.queues q WHERE q.id = p_id;
$$;

CREATE FUNCTION public.get_queue_by_access_code(p_code text) RETURNS SETOF public.queues
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT q.* FROM public.queues q
  WHERE p_code IS NOT NULL AND length(p_code) >= 6 AND q.access_code = p_code AND q.active IS NOT FALSE;
$$;

CREATE FUNCTION public.queue_accepts_songs(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM public.queues q WHERE q.id = p_id AND q.active IS NOT FALSE);
$$;

REVOKE ALL ON FUNCTION public.get_queue(uuid), public.get_queue_by_access_code(text),
  public.queue_accepts_songs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_queue(uuid), public.get_queue_by_access_code(text),
  public.queue_accepts_songs(uuid) TO anon, authenticated;

DROP POLICY songs_insert_own ON public.songs;
CREATE POLICY songs_insert_own ON public.songs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = added_by AND public.queue_accepts_songs(queue_id));
