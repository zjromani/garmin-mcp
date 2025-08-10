# Garmin MCP Server

A webhook receiver and MCP (Model Context Protocol) server that collects Garmin health data and makes it available to ChatGPT through OpenAI's Remote MCP integration.

## Features

- **Garmin Webhook Receiver**: Accepts health data from Garmin devices
- **SQLite Persistence**: Stores data in SQLite database on EFS for reliability
- **MCP Integration**: Provides health data to ChatGPT via OpenAI's Remote MCP
- **AWS Deployment**: Runs on ECS Fargate with Terraform infrastructure
- **Rate Limiting**: Protects webhook endpoints from abuse

## Architecture

```
Garmin Device → Webhook → SQLite DB → MCP Server → ChatGPT
```

## Data Collected

- Daily step count
- Resting heart rate
- Active calories burned
- Sleep duration
- Body battery levels

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/garmin-mcp.git
cd garmin-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

4. Build and run:
```bash
npm run build
npm start
```

### Docker

```bash
docker-compose up --build
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 8080) | No |
| `MCP_API_TOKEN` | Bearer token for MCP authentication | Yes |
| `GARMIN_WEBHOOK_SECRET` | Secret for webhook signature verification | No |
| `GARMIN_API_KEY` | Garmin Health API key | No |
| `GARMIN_API_SECRET` | Garmin Health API secret | No |

## API Endpoints

### Webhook
- `POST /garmin/webhook` - Receives Garmin health data

### MCP (Model Context Protocol)
- `GET /mcp/tools` - Lists available tools
- `POST /mcp/tools/call` - Executes a tool
- `GET /mcp/sse` - Server-sent events endpoint

### Health
- `GET /healthz` - Health check endpoint

## MCP Tools

### `garmin.getDailySummary`
Get daily health summary for a user and date.

**Parameters:**
- `user_id` (string, required): User identifier
- `date` (string, optional): Date in YYYY-MM-DD format (defaults to today)

### `garmin.getRecentDays`
Get health data for the last N days.

**Parameters:**
- `user_id` (string, required): User identifier
- `days` (number, optional): Number of days to retrieve (default: 7)

## Deployment

### AWS with Terraform

1. Configure AWS credentials
2. Update `terraform/variables.tf` with your settings
3. Deploy:
```bash
cd terraform
./deploy.sh
```

### Manual Deployment

1. Build the Docker image
2. Push to ECR
3. Deploy to ECS Fargate

## Privacy

This is a personal, non-commercial project. See [PRIVACY.md](PRIVACY.md) for details on data collection and usage.

## License

Personal use only. This project is not intended for commercial use.

## Contributing

This is a personal project, but suggestions and improvements are welcome through issues and discussions.
