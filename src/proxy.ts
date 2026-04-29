import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const publicRoutes = ['/login']

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublic = publicRoutes.some(r => path.startsWith(r))

  const session = await getSession()

  if (!isPublic && !session.isAuthenticated) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublic && session.isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$|.*\\.svg$).*)'],
}
