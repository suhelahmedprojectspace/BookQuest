import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'


const protectedPaths = ['/browse', '/favorites', '/profile']


const authPaths = ['/login', '/signup']


// const publicPaths = ['/', '/about', '/contact']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value

  const isProtectedPath = protectedPaths.some(path => 
    pathname.startsWith(path)
  )
 
  const isAuthPath = authPaths.some(path => 
    pathname.startsWith(path)
  )

  // const isPublicPath = publicPaths.some(path => 
  //   pathname === path || pathname.startsWith(path)
  // )

  try {

    if (isAuthPath && token) {
      console.log(`Authenticated user accessing auth page ${pathname}, redirecting to /browse`)
      return NextResponse.redirect(new URL('/browse', request.url))
    }

    if (isProtectedPath && !token) {
      console.log(`Unauthenticated user accessing protected path ${pathname}, redirecting to login`)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }


    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response

  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
   
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
