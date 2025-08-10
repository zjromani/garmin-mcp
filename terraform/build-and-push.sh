#!/bin/bash

set -e

echo "🐳 Building and pushing Docker image to ECR..."

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
ECR_REPO="garmin-mcp"

# Generate version tag from git
VERSION=$(git describe --tags --always --dirty)
if [ -z "$VERSION" ]; then
  VERSION="latest-$(git rev-parse --short HEAD)"
fi

echo "✅ AWS Account: $AWS_ACCOUNT_ID"
echo "✅ AWS Region: $AWS_REGION"
echo "✅ ECR Repository: $ECR_REPO"
echo "✅ Version: $VERSION"

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the Docker image
echo "🔨 Building Docker image..."
cd ..
docker build -t $ECR_REPO:$VERSION .

# Tag the image
echo "🏷️  Tagging image..."
docker tag $ECR_REPO:$VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$VERSION
docker tag $ECR_REPO:$VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Push the image
echo "📤 Pushing images to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$VERSION
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

echo "✅ Docker images pushed successfully!"
echo ""
echo "🔄 To deploy this version, update the task definition:"
echo "   aws ecs update-service --cluster garmin-mcp-cluster --service garmin-mcp-service --force-new-deployment"
echo ""
echo "📊 To check the deployment status, run:"
echo "   aws ecs describe-services --cluster garmin-mcp-cluster --services garmin-mcp-service"
echo ""
echo "🔄 To rollback to a previous version, update the task definition image tag and redeploy."
