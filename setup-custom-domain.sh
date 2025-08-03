#!/bin/bash

# Custom Domain Setup for App Runner
# Replace these variables with your values
DOMAIN_NAME="api.yourdomain.com"
SERVICE_ARN="arn:aws:apprunner:us-east-1:842733143746:service/symentic-api/e6e89e11c6194674bbbf56fdfabb7b34"
CERTIFICATE_ARN="arn:aws:acm:us-east-1:842733143746:certificate/YOUR-CERT-ID"

echo "🔗 Setting up custom domain for App Runner..."

# Step 1: Create custom domain association
aws apprunner associate-custom-domain \
  --service-arn $SERVICE_ARN \
  --domain-name $DOMAIN_NAME \
  --enable-www-subdomain \
  --profile leogao

echo "✅ Custom domain association created!"
echo "📋 Next steps:"
echo "1. Add CNAME record in your DNS:"
echo "   Name: $DOMAIN_NAME"
echo "   Value: [CNAME from App Runner console]"
echo "2. Wait for domain validation (15-30 minutes)"

# Optional: Create Route 53 record if using Route 53
# aws route53 change-resource-record-sets --hosted-zone-id YOUR-ZONE-ID --change-batch file://dns-change.json