# Privacy Policy

**Last updated:** 2025-08-09

## Overview

This privacy policy describes how this personal, non-commercial project collects, uses, and protects your Garmin health data.

## Data Collection

### What We Collect
We collect the following health data from your Garmin device via webhooks:
- Daily step count
- Resting heart rate
- Active calories burned
- Sleep duration
- Body battery levels (min/max)
- Raw webhook payload data

### How We Collect It
- Garmin sends this data to our webhook endpoint when your device syncs
- We only receive data that Garmin chooses to send based on your device settings

## Data Storage

### Where We Store It
- All data is stored locally in a SQLite database
- The database file is stored on AWS EFS (Elastic File System)
- Data is encrypted at rest using AWS EFS encryption

### Data Retention
- Data is retained indefinitely unless you request deletion
- You can request deletion of your data at any time

## How We Use Your Data

### Primary Use
- Provide health statistics and trends through ChatGPT integration
- Enable conversational queries about your fitness data
- Generate insights about your health patterns

### What We Don't Do
- We never sell your data to third parties
- We never share your data with advertisers
- We never use your data for commercial purposes
- We never analyze your data for purposes other than providing you with insights

## Data Security

### Protection Measures
- All data is stored in a private AWS environment
- Database access is restricted to the application only
- Webhook endpoints are rate-limited and authenticated
- All communications use HTTPS encryption

## Your Rights

### Data Access
You can request a copy of all data we have stored for you.

### Data Deletion
You can request complete deletion of your data by contacting us.

### Data Correction
You can request correction of any inaccurate data we have stored.

## Third-Party Services

### Garmin
- We receive data from Garmin's webhook service
- Garmin's privacy policy applies to their collection and use of your data
- We only process data that Garmin sends to us

### AWS
- We use AWS ECS and EFS for hosting and storage
- AWS does not have access to your health data
- Data is encrypted and isolated in our private environment

## Contact Information

For any questions about this privacy policy or to exercise your data rights:

**Email:** zjromani@gmail.com

**Response Time:** We will respond to all requests within 30 days.

## Changes to This Policy

We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page.

## Legal Basis

This is a personal, non-commercial project. We process your data based on your consent when you configure Garmin to send data to our webhook endpoint.
