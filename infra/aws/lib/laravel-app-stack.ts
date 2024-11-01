import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'
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
  s3: {
    logBucketName: string
  }
  vpc: {
    cidr: string
  }
}

const HTTP = 80
const HTTPS = 443

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
      clusterName: 'LaravelApp',
      vpc,
    })

    // Security Group: for ECS
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', { vpc })
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(HTTP))
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(HTTPS))

    // SSM Parameters for ecspresso
    new ssm.StringParameter(this, 'EcspressoSubnetId1Param', {
      parameterName: '/ecs/aws-cdk-ecspresso-laravel-example-2024/subnet-id-a',
      stringValue: vpcSubnetIds[0],
    })
    new ssm.StringParameter(this, 'EcspressoSubnetId2Param', {
      parameterName: '/ecs/aws-cdk-ecspresso-laravel-example-2024/subnet-id-c',
      stringValue: vpcSubnetIds[1],
    })
    new ssm.StringParameter(this, 'EcspressoSecurityGroupIdParam', {
      parameterName: '/ecs/aws-cdk-ecspresso-laravel-example-2024/security-group-id',
      stringValue: ecsSecurityGroup.securityGroupId,
    })
    new ssm.StringParameter(this, 'EcspressoTargetGroupArnParam', {
      parameterName: '/ecs/aws-cdk-ecspresso-laravel-example-2024/target-group-arn',
      stringValue: alb.targetGroupArn,
    })
  }
}
