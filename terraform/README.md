# AWS Infrastructure for Garmin MCP

This Terraform configuration deploys the Garmin MCP application to AWS using ECS Fargate.

## Architecture

- **ECS Fargate**: Serverless container hosting with public IP
- **In-Memory Cache**: Fast data storage (no persistence)
- **VPC**: Isolated network with public subnets
- **ECR**: Container registry
- **CloudWatch**: Logging and monitoring

## Prerequisites

1. **AWS CLI** installed and configured
2. **Terraform** installed
3. **Docker** running locally
4. **AWS credentials** configured (`aws configure`)

## Deployment

### 1. Deploy Infrastructure

```bash
cd terraform
./deploy.sh
```

This will:
- Create VPC, subnets, and security groups
- Create ECS cluster and service with public IP
- Create ECR repository
- Generate MCP API token

### 2. Build and Deploy Application

```bash
./build-and-push.sh
```

This will:
- Build Docker image
- Push to ECR
- ECS will automatically deploy the new image

## Estimated Costs

- **ECS Fargate**: ~$3-5/month (256 CPU, 512MB RAM)
- **Data transfer**: ~$1-2/month
- **Total**: ~$5-7/month

## Outputs

After deployment, you'll get:
- **Application URL**: ECS service public IP
- **MCP API Token**: For ChatGPT Remote MCP integration

## Cleanup

To destroy all resources:

```bash
cd terraform
terraform destroy
```

⚠️ **Warning**: This will delete all data and resources!
