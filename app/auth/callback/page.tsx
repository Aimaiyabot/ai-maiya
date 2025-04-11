'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        console.error('OAuth session error:', error);
      }

      // redirect to home or dashboard
      router.push('/');
    };

    handleOAuthRedirect();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-pink-50">
      <p className="text-pink-500 font-medium text-lg">Hang tight babe, logging you in... 💖</p>
    </div>
  );
}
