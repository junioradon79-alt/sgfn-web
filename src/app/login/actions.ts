'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export type LoginState = {
  error?: string;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Veuillez saisir votre e-mail et votre mot de passe.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Identifiants incorrects. Veuillez réessayer.' };
  }

  redirect('/dashboard');
}
