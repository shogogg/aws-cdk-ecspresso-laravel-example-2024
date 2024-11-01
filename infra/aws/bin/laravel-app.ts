#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import * as dotenv from 'dotenv'
import { LaravelAppStack } from '../lib/laravel-app-stack'

// Load environment variables from .env file
dotenv.config()

const account = process.env.APP_AWS_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT
const region = process.env.APP_AWS_REGION ?? process.env.CDK_DEFAULT_REGION
const appName = process.env.APP_NAME ?? 'ExampleApp'
const hostedZoneName = process.env.APP_HOSTED_ZONE_NAME ?? 'example.com'
const domainName = process.env.APP_DOMAIN_NAME ?? 'app.example.com'
const logBucketName = process.env.APP_LOG_BUCKET_NAME ?? 'example-log-bucket'

const app = new cdk.App()
new LaravelAppStack(app, `${appName}LaravelAppStack`, {
  env: {
    account,
    region,
  },
  hostedZoneName,
  domainName,
  ecr: {
    repositories: [
      { id: 'App', repositoryName: 'aws-cdk-ecspresso-laravel-example-2024/app' },
      { id: 'Nginx', repositoryName: 'aws-cdk-ecspresso-laravel-example-2024/nginx' },
    ],
  },
  s3: {
    logBucketName,
  },
  vpc: {
    cidr: '192.168.0.0/16',
  },
})
