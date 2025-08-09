# garmin-mcp

Local run:
- Copy env.example to .env if you want external DB settings
- docker compose up --build
- POST test data to http://localhost:8080/garmin/webhook
- MCP SSE at http://localhost:8080/mcp/sse with Authorization: Bearer <MCP_API_TOKEN>

Production:
- Deploy container to Fly.io
- Use Neon for DATABASE_URL
