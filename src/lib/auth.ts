import { type NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user as { id: string; name?: string | null; email?: string | null }
}
