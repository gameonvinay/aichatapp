import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://host.docker.internal:8080'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    return new Response(JSON.stringify({ error: 'Failed to connect' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const reader = response.body.getReader()

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        controller.error(err)
      }
    },
    cancel() {
      reader.cancel()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
