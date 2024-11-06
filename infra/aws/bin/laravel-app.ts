#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import * as dotenv from 'dotenv'
import { LaravelAppStack } from '../lib/laravel-app-stack'

// Load environment variables from .env file
dotenv.config()

const account = process.env.APP_AWS_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT
const region = process.env.APP_AWS_REGION ?? process.env.CDK_DEFAULT_REGION

const stackName = process.env.APP_STACK_NAME ?? 'ExampleLaravelAppStack'

const app = new cdk.App()
new LaravelAppStack(app, stackName, {
  env: {
    account,
    region,
  },
  hostedZoneName: process.env.APP_HOSTED_ZONE_NAME ?? 'example.com',
  domainName: process.env.APP_DOMAIN_NAME ?? 'app.example.com',
  ecr: {
    repositories: [
      { id: 'Nginx', repositoryName: 'aws-cdk-ecspresso-laravel-example-2024/nginx-prod' },
      { id: 'AppCli', repositoryName: 'aws-cdk-ecspresso-laravel-example-2024/app-cli-prod' },
      { id: 'AppServer', repositoryName: 'aws-cdk-ecspresso-laravel-example-2024/app-server-prod' },
    ],
  },
  ecs: {
    clusterName: process.env.APP_ECS_CLUSTER_NAME ?? 'example-laravel-app-cluster',
  },
  s3: {
    logBucketName: process.env.APP_LOG_BUCKET_NAME ?? 'example-log-bucket',
  },
  vpc: {
    cidr: '192.168.0.0/16',
  },
})
