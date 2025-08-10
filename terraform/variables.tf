variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "garmin-mcp"
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "garmin-mcp"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

variable "cloudflare_tunnel_token" {
  description = "Cloudflare Tunnel token for secure outbound-only access"
  type        = string
  sensitive   = true
}
