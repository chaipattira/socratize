'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-10 rounded-xl shadow-xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Socratize</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Extract your expertise into AI-ready knowledge files
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full bg-white text-gray-900 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 transition"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
