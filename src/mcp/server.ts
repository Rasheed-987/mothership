import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { createCrmMcpServer } from './crm-server'

async function main() {
  const server = createCrmMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // In stdio MCP mode, logging MUST be on stderr (console.error), never stdout!
  console.error('[Mothership MCP] CRM Server running on stdio')
}

main().catch((err) => {
  console.error('[Mothership MCP] Fatal server error:', err)
  process.exit(1)
})
