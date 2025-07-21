import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.summary.delete({
      where: { id: params.id }
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting summary:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
