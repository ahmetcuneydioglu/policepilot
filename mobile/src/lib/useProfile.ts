import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Profile } from './types';

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(data ?? null);
      setLoading(false);
    });
  }, []);

  return {
    profile, loading,
    agencyId: profile?.agency_id ?? null,
    role: profile?.role ?? null,
    userId,
  };
}
