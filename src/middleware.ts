export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/organizer/dashboard/:path*', '/organizer/events/:path*'],
}
