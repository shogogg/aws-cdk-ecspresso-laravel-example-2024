import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { ApplicationLoadBalancer } from './constructs/application-load-balancer'

interface LaravelAppStackProps extends cdk.StackProps {
  domainName: string
  hostedZoneName: string
  ecr: {
    repositories: Array<{
      id: string
      repositoryName: string
    }>
  }
  ecs: {
    clusterName: string
    serviceName: string
  }
  s3: {
    logBucketName: string
  }
  vpc: {
    cidr: string
  }
}

export class LaravelAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LaravelAppStackProps) {
    super(scope, id, props)

    // Route 53: Hosted Zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneName,
    })

    // S3: Bucket for ALB access logs
    const logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: props.s3.logBucketName,
      lifecycleRules: [{ expiration: cdk.Duration.days(365) }],
    })

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpc.cidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    })
    const vpcSubnetIds = vpc.privateSubnets.map(subnet => subnet.subnetId)
    if (vpcSubnetIds.length !== 2) {
      throw new Error('Unexpected number of private subnets')
    }

    // ALB
    const alb = new ApplicationLoadBalancer(this, 'Alb', {
      domainName: props.domainName,
      hostedZone,
      logBucket,
      vpc,
    })

    // ECR: Repositories
    for (const { id, repositoryName } of props.ecr.repositories) {
      new ecr.Repository(this, `Ecr${id}`, {
        repositoryName,
        lifecycleRules: [
          {
            description: 'hold 10 images',
            maxImageCount: 10,
          },
        ],
      })
    }

    // ECS: Cluster
    new ecs.Cluster(this, 'EcsCluster', {
      clusterName: props.ecs.clusterName,
      vpc,
    })

    // IAM: Role for ECS
    const ecsTaskExecutionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess')],
    })

    // CloudWatch: Log Groups for ECS
    new logs.LogGroup(this, 'EcsNginxLogGroup', {
      logGroupName: `/ecs/${props.ecs.serviceName}/nginx`,
      retention: logs.RetentionDays.TEN_YEARS,
    })
    new logs.LogGroup(this, 'EcsAppServerLogGroup', {
      logGroupName: `/ecs/${props.ecs.serviceName}/app-server`,
      retention: logs.RetentionDays.TEN_YEARS,
    })
    new logs.LogGroup(this, 'EcsAppBatchLogGroup', {
      logGroupName: `/ecs/${props.ecs.serviceName}/app-batch`,
      retention: logs.RetentionDays.TEN_YEARS,
    })

    // Security Group: for ECS
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', { vpc })
    ecsSecurityGroup.addIngressRule(alb.securityGroup, ec2.Port.tcp(8080))

    // Cloudformation Outputs
    new cdk.CfnOutput(this, 'PrivateSubnetAz1', {
      value: vpcSubnetIds[0],
    })
    new cdk.CfnOutput(this, 'PrivateSubnetAz2', {
      value: vpcSubnetIds[1],
    })
    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: ecsSecurityGroup.securityGroupId,
    })
    new cdk.CfnOutput(this, 'AlbTargetGroupArn', {
      value: alb.targetGroupArn,
    })
    new cdk.CfnOutput(this, 'EcsTaskExecutionRoleArn', {
      value: ecsTaskExecutionRole.roleArn,
    })
  }
}
