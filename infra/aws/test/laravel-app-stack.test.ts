import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { beforeAll, describe, it } from 'vitest'
import { LaravelAppStack } from '../lib/laravel-app-stack'

describe('LaravelAppStack', () => {
  let template: Template

  beforeAll(() => {
    const app = new cdk.App()
    const stack = new LaravelAppStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
      domainName: 'app.example.org',
      hostedZoneName: 'example.org',
      ecr: {
        repositories: [
          { id: 'foo', repositoryName: 'laravel-app/foo' },
          { id: 'bar', repositoryName: 'laravel-app/bar' },
          { id: 'baz', repositoryName: 'laravel-app/baz' },
        ],
      },
      s3: {
        logBucketName: 'example-log-storage',
      },
      vpc: {
        cidr: '192.168.0.0/16',
      },
    })
    template = Template.fromStack(stack)
  })

  it('has a S3 bucket for ALB access logs', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1)
  })

  it('has a S3 bucket with the specified name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'example-log-storage',
    })
  })

  it('has a VPC', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1)
  })

  it('has a VPC with the specified CIDR', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '192.168.0.0/16',
    })
  })

  describe('VPC', () => {
    it('has a NAT gateway', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 1)
    })

    it('has a Internet Gateway', () => {
      template.resourceCountIs('AWS::EC2::InternetGateway', 1)
    })

    it('has 4 subnets', () => {
      template.resourceCountIs('AWS::EC2::Subnet', 4)
    })

    describe('Availability Zone A', () => {
      it('has a public subnet', () => {
        template.hasResourceProperties('AWS::EC2::Subnet', {
          AvailabilityZone: 'dummy1a',
          MapPublicIpOnLaunch: true,
        })
      })

      it('has a private subnet', () => {
        template.hasResourceProperties('AWS::EC2::Subnet', {
          AvailabilityZone: 'dummy1a',
          MapPublicIpOnLaunch: false,
        })
      })
    })

    describe('Availability Zone B', () => {
      it('has a public subnet', () => {
        template.hasResourceProperties('AWS::EC2::Subnet', {
          AvailabilityZone: 'dummy1b',
          MapPublicIpOnLaunch: true,
        })
      })

      it('has a private subnet', () => {
        template.hasResourceProperties('AWS::EC2::Subnet', {
          AvailabilityZone: 'dummy1b',
          MapPublicIpOnLaunch: false,
        })
      })
    })
  })

  it('has 2 security groups', () => {
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2)
  })

  it('has a security group for the Application Load Balancer', () => {
    const [vpcId] = Object.keys(template.findResources('AWS::EC2::VPC'))
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'TestStack/Alb/SecurityGroup',
      SecurityGroupIngress: [
        Match.objectLike({
          FromPort: 80,
          IpProtocol: 'tcp',
          ToPort: 80,
        }),
        Match.objectLike({
          FromPort: 443,
          IpProtocol: 'tcp',
          ToPort: 443,
        }),
      ],
      VpcId: { Ref: vpcId },
    })
  })

  it('has a security group for the ECS', () => {
    const [vpcId] = Object.keys(template.findResources('AWS::EC2::VPC'))
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'TestStack/EcsSecurityGroup',
      SecurityGroupIngress: [
        Match.objectLike({
          FromPort: 80,
          IpProtocol: 'tcp',
          ToPort: 80,
        }),
        Match.objectLike({
          FromPort: 443,
          IpProtocol: 'tcp',
          ToPort: 443,
        }),
      ],
      VpcId: { Ref: vpcId },
    })
  })

  it('has an ACM certificate for the Application Load Balancer', () => {
    template.resourceCountIs('AWS::CertificateManager::Certificate', 1)
  })

  it('has an ACM certificate with the specified domain name', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'app.example.org',
    })
  })

  it('has an Application Load Balancer', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1)
  })

  it('has an Application Load Balancer that is internet-facing', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
    })
  })

  it('has an Application Load Balancer with the public subnets', () => {
    const subnets = template.findResources('AWS::EC2::Subnet', {
      Properties: {
        MapPublicIpOnLaunch: true,
      },
    })
    const subnetIds = Object.keys(subnets).map(ref => ({ Ref: ref }))
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Subnets: subnetIds,
    })
  })

  it('has an Application Load Balancer with the security group', () => {
    const securityGroup = template.findResources('AWS::EC2::SecurityGroup', {
      Properties: {
        GroupDescription: 'TestStack/Alb/SecurityGroup',
      },
    })
    const [securityGroupId] = Object.keys(securityGroup)
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      SecurityGroups: [{ 'Fn::GetAtt': [securityGroupId, 'GroupId'] }],
    })
  })

  it('has a target group', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1)
  })

  it('has a target group with the specified properties', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 80,
      Protocol: 'HTTP',
      TargetType: 'ip',
    })
  })

  it('has 2 Listeners', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 2)
  })

  it('has an HTTPS Listener', () => {
    const certificates = template.findResources('AWS::CertificateManager::Certificate')
    const [certificateArn] = Object.keys(certificates)
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Certificates: [{ CertificateArn: { Ref: certificateArn } }],
      Port: 443,
      Protocol: 'HTTPS',
    })
  })

  it('has an HTTP Listener', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    })
  })

  it('should redirect HTTP to HTTPS', () => {
    const listeners = template.findResources('AWS::ElasticLoadBalancingV2::Listener', {
      Properties: {
        Protocol: 'HTTP',
      },
    })
    const [listenerArn] = Object.keys(listeners)
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Actions: [
        {
          RedirectConfig: {
            Protocol: 'HTTPS',
            StatusCode: 'HTTP_301',
          },
          Type: 'redirect',
        },
      ],
      Conditions: [
        {
          Field: 'path-pattern',
          PathPatternConfig: {
            Values: ['*'],
          },
        },
      ],
      ListenerArn: { Ref: listenerArn },
      Priority: 1,
    })
  })

  it('has 2 RecordSets', () => {
    template.resourceCountIs('AWS::Route53::RecordSet', 2)
  })

  it('has an A RecordSet', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'app.example.org.',
      Type: 'A',
    })
  })

  it('has an AAAA RecordSet', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'app.example.org.',
      Type: 'AAAA',
    })
  })

  it('has the number of ECR repositories that is specified by the props', () => {
    template.resourceCountIs('AWS::ECR::Repository', 3)
  })

  it.each([['laravel-app/foo'], ['laravel-app/bar'], ['laravel-app/baz']])(
    'has an ECR repository with the specified name (%s)',
    repositoryName => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: repositoryName,
      })
    },
  )

  it('has an ECS Cluster', () => {
    template.resourceCountIs('AWS::ECS::Cluster', 1)
  })

  it('has an ECS Cluster with the specified name', () => {
    template.hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'LaravelApp',
    })
  })

  it('has an Output for the first subnet ID', () => {
    const subnets = template.findResources('AWS::EC2::Subnet', {
      Properties: {
        MapPublicIpOnLaunch: false,
      },
    })
    const subnetIds = Object.keys(subnets)
    template.hasOutput('PrivateSubnetAz1', {
      Value: { Ref: subnetIds[0] },
    })
  })

  it('has an Output for the second subnet ID', () => {
    const subnets = template.findResources('AWS::EC2::Subnet', {
      Properties: {
        MapPublicIpOnLaunch: false,
      },
    })
    const subnetIds = Object.keys(subnets)
    template.hasOutput('PrivateSubnetAz2', {
      Value: { Ref: subnetIds[1] },
    })
  })

  it('has an Output for the security group ID', () => {
    const securityGroups = template.findResources('AWS::EC2::SecurityGroup', {
      Properties: {
        GroupDescription: 'TestStack/EcsSecurityGroup',
      },
    })
    const [securityGroupId] = Object.keys(securityGroups)
    template.hasOutput('EcsSecurityGroupId', {
      Value: { 'Fn::GetAtt': [securityGroupId, 'GroupId'] },
    })
  })

  it('has an Output for the target group ARN', () => {
    const targetGroups = template.findResources('AWS::ElasticLoadBalancingV2::TargetGroup')
    const [targetGroupArn] = Object.keys(targetGroups)
    template.hasOutput('AlbTargetGroupArn', {
      Value: { Ref: targetGroupArn },
    })
  })
})
