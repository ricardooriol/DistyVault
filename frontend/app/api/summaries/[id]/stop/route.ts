import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const summary = await prisma.summary.update({
      where: { id: params.id },
      data: { status: 'stopped' }
    })

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error stopping summary:', error)
    return new Response(JSON.stringify({ error: 'Failed to stop summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
