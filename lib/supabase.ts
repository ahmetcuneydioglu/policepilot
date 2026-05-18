import { createClient } from "@supabase/supabase-js";

// createClient is deferred so the module is safe to import without env vars
// (Next.js pre-renders "use client" shells server-side before hydration)
let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_t, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getClient() as any;
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
