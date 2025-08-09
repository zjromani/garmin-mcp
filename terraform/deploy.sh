#!/bin/bash

set -e

echo "🚀 Deploying Garmin MCP to AWS ECS Fargate..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install it first:"
    echo "   https://developer.hashicorp.com/terraform/downloads"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker not running. Please start Docker first."
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run:"
    echo "   aws configure"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo "✅ AWS Account: $AWS_ACCOUNT_ID"
echo "✅ AWS Region: $AWS_REGION"

# Initialize Terraform
echo "🔧 Initializing Terraform..."
cd terraform
terraform init

# Plan the deployment
echo "📋 Planning deployment..."
terraform plan -out=tfplan

# Ask for confirmation
read -p "🤔 Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

# Apply the plan
echo "🚀 Applying Terraform plan..."
terraform apply tfplan

# Get outputs
echo "📊 Getting deployment outputs..."
ALB_DNS=$(terraform output -raw alb_dns_name)
MCP_TOKEN=$(terraform output -raw mcp_api_token)
DB_ENDPOINT=$(terraform output -raw database_endpoint)

echo "✅ Infrastructure deployed successfully!"
echo ""
echo "🌐 Application URL: http://$ALB_DNS"
echo "🔑 MCP API Token: $MCP_TOKEN"
echo "🗄️  Database Endpoint: $DB_ENDPOINT"
echo ""
echo "📝 Next steps:"
echo "1. Build and push Docker image to ECR"
echo "2. Test the application endpoints"
echo "3. Configure ChatGPT Remote MCP"
echo ""
echo "💡 To build and push the Docker image, run:"
echo "   ./build-and-push.sh"
