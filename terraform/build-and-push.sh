#!/bin/bash

set -e

echo "🐳 Building and pushing Docker image to ECR..."

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
ECR_REPO="garmin-mcp"

echo "✅ AWS Account: $AWS_ACCOUNT_ID"
echo "✅ AWS Region: $AWS_REGION"
echo "✅ ECR Repository: $ECR_REPO"

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the Docker image
echo "🔨 Building Docker image..."
cd ..
docker build -t $ECR_REPO .

# Tag the image
echo "🏷️  Tagging image..."
docker tag $ECR_REPO:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Push the image
echo "📤 Pushing image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

echo "✅ Docker image pushed successfully!"
echo ""
echo "🔄 ECS will automatically pull the new image and update the service."
echo "⏳ This may take a few minutes to complete."
echo ""
echo "📊 To check the deployment status, run:"
echo "   aws ecs describe-services --cluster garmin-mcp-cluster --services garmin-mcp-service"
