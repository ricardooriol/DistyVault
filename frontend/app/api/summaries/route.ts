import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const summaries = await prisma.summary.findMany({
      orderBy: { date: 'desc' }
    })
    
    return new Response(JSON.stringify({ summaries }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching summaries:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch summaries' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
