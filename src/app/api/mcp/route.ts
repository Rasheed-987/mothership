import { createMcpHandler } from '@modelcontextprotocol/server'
import { createCrmMcpServer } from '@/mcp/crm-server'

// Force dynamic execution for Next.js API route
export const dynamic = 'force-dynamic'

const mcpHandler = createMcpHandler(() => createCrmMcpServer())

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-mcp-secret, Accept',
}

function verifyAuth(req: Request): boolean {
  const secret = process.env.MOTHERSHIP_MCP_SECRET
  if (!secret) return true // If unconfigured, allow local dev access

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const [type, token] = authHeader.split(' ')
    if (type?.toLowerCase() === 'bearer' && token === secret) {
      return true
    }
  }

  // 2. Custom headers: x-api-key or x-mcp-secret
  const apiKey = req.headers.get('x-api-key') || req.headers.get('x-mcp-secret')
  if (apiKey === secret) {
    return true
  }

  // 3. Query string token (?secret=...)
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === secret) {
    return true
  }

  return false
}

function ensureAcceptHeader(req: Request): Request {
  const accept = req.headers.get('accept')
  if (!accept || accept === '*/*') {
    const headers = new Headers(req.headers)
    headers.set('accept', 'application/json, text/event-stream')
    return new Request(req.url, {
      method: req.method,
      headers,
      body: req.body,
      // @ts-expect-error Node/Undici duplex requirement
      duplex: 'half',
    })
  }
  return req
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function GET(req: Request) {
  if (!verifyAuth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing Bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  const processedReq = ensureAcceptHeader(req)
  const response = await mcpHandler.fetch(processedReq)

  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function POST(req: Request) {
  if (!verifyAuth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing Bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  const processedReq = ensureAcceptHeader(req)
  const response = await mcpHandler.fetch(processedReq)

  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
