// One-time migration function to create tournament tables
// Protected by a secret header

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-migration-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get('x-migration-secret');
  if (secret !== 'tourn_2026_setup') return json({ error: 'Unauthorized' }, 401);

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  const url   = Deno.env.get('SUPABASE_URL')!;
  const skey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!dbUrl) return json({ error: 'SUPABASE_DB_URL not available' }, 500);

  try {
    // Use postgres client for raw DDL
    const { Client } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts');
    const client = new Client(dbUrl);
    await client.connect();

    const stmts = [
      `CREATE TABLE IF NOT EXISTS tournament_games (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        image_url text,
        is_active boolean DEFAULT true,
        sort_order int DEFAULT 0,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS tournament_types (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        sort_order int DEFAULT 0,
        is_active boolean DEFAULT true
      )`,
      `CREATE TABLE IF NOT EXISTS tournaments (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        game_id uuid REFERENCES tournament_games(id) ON DELETE CASCADE,
        type_id uuid REFERENCES tournament_types(id) ON DELETE SET NULL,
        name text NOT NULL,
        mode text DEFAULT 'classic',
        image_url text,
        entry_fee_usdt numeric DEFAULT 0,
        prize_pool numeric DEFAULT 0,
        max_participants int DEFAULT 100,
        current_participants int DEFAULT 0,
        status text DEFAULT 'upcoming',
        starts_at timestamptz,
        ends_at timestamptz,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS tournament_balances (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id text NOT NULL UNIQUE,
        amount numeric DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS tournament_entries (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        registered_at timestamptz DEFAULT now(),
        result_rank int,
        prize_won numeric DEFAULT 0,
        UNIQUE(tournament_id, user_id)
      )`,
      `INSERT INTO tournament_types (name, sort_order) VALUES ('Single', 0), ('Duo', 1), ('Team', 2) ON CONFLICT DO NOTHING`,
      `ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE tournament_types ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE tournament_balances ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY`,
      `DO $do$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_games' AND policyname='public read tournament_games') THEN
          CREATE POLICY "public read tournament_games" ON tournament_games FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_types' AND policyname='public read tournament_types') THEN
          CREATE POLICY "public read tournament_types" ON tournament_types FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournaments' AND policyname='public read tournaments') THEN
          CREATE POLICY "public read tournaments" ON tournaments FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_balances' AND policyname='public read tournament_balances') THEN
          CREATE POLICY "public read tournament_balances" ON tournament_balances FOR SELECT USING (true);
          CREATE POLICY "public write tournament_balances" ON tournament_balances FOR INSERT WITH CHECK (true);
          CREATE POLICY "public update tournament_balances" ON tournament_balances FOR UPDATE USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_entries' AND policyname='public read tournament_entries') THEN
          CREATE POLICY "public read tournament_entries" ON tournament_entries FOR SELECT USING (true);
          CREATE POLICY "public insert tournament_entries" ON tournament_entries FOR INSERT WITH CHECK (true);
        END IF;
      END $do$`,
    ];

    const errors: string[] = [];
    for (const stmt of stmts) {
      try {
        await client.queryObject(stmt);
      } catch (e: any) {
        if (!e.message?.includes('already exists') && !e.message?.includes('42P07') && !e.message?.includes('42710')) {
          errors.push(e.message?.substring(0, 150) || 'unknown error');
        }
      }
    }

    await client.end();

    return json({ ok: true, errors: errors.length ? errors : undefined, message: 'Migration complete' });
  } catch (e: any) {
    return json({ error: e.message || 'Migration failed' }, 500);
  }
});
