# AWS Infrastructure for Garmin MCP

This Terraform configuration deploys the Garmin MCP application to AWS using ECS Fargate.

## Architecture

- **ECS Fargate**: Serverless container hosting
- **In-Memory Cache**: Fast data storage (no persistence)
- **Application Load Balancer**: Public access
- **VPC**: Isolated network with public/private subnets
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
- Create ECS cluster and service
- Set up Application Load Balancer
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
- **ALB**: ~$20/month
- **Data transfer**: ~$1-2/month
- **Total**: ~$25-30/month

## Outputs

After deployment, you'll get:
- **Application URL**: Public load balancer URL
- **MCP API Token**: For ChatGPT Remote MCP integration

## Cleanup

To destroy all resources:

```bash
cd terraform
terraform destroy
```

⚠️ **Warning**: This will delete all data and resources!
