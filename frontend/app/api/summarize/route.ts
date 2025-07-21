import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    const summary = await prisma.summary.create({
      data: {
        type: 'url',
        status: 'scraping',
        url: text,
        date: new Date().toISOString(),
      }
    })

    // Start the summarization process
    // This would be handled by your background processing system
    
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error creating summary:', error)
    return new Response(JSON.stringify({ error: 'Failed to create summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
