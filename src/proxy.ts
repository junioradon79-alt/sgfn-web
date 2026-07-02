import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Exportation par défaut stricte demandée par Next.js 16
export default async function proxy(request: NextRequest) {
  // Initialisation de la réponse de base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Client Supabase SSR pour la gestion des sessions
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Vérification de la session active
  const { data: { session } } = await supabase.auth.getSession();

  // Protection de l'espace SaaS SGNF
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

// Configuration du ciblage
export const config = {
  matcher: ['/dashboard/:path*'],
};
