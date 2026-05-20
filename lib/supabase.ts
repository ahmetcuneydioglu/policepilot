import { createBrowserClient } from "@supabase/ssr";

// createBrowserClient stores auth tokens in cookies (not localStorage)
// so Next.js middleware can read them for server-side auth checks.
let _client: ReturnType<typeof createBrowserClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_t, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getClient() as any;
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
