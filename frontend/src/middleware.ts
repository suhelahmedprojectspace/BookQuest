import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'


const protectedPaths = ['/browse', '/favorites', '/profile']
const authPaths = ['/login', '/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value

  const isProtectedPath = protectedPaths.some(path => 
    pathname.startsWith(path)
  )
  

  const isAuthPath = authPaths.some(path => 
    pathname.startsWith(path)
  )


  if (isAuthPath && token) {
    return NextResponse.redirect(new URL('/browse', request.url))
  }


  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
