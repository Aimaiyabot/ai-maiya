'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabaseClient';

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-4 text-pink-500 text-center">Welcome to Maiya 💖</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="light"
          providers={['google']}
          redirectTo={
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback`
              : undefined
          }          
        />
      </div>
    </div>
  );
}
