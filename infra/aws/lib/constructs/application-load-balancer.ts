import * as cdk from 'aws-cdk-lib'
import * as certificationManager from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import type * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

const HTTP = 80
const HTTPS = 443

export interface ApplicationLoadBalancerProps {
  domainName: string
  hostedZone: route53.IHostedZone
  logBucket: s3.IBucket
  vpc: ec2.IVpc
}

export class ApplicationLoadBalancer extends Construct {
  public readonly targetGroupArn: string

  constructor(scope: Construct, id: string, props: ApplicationLoadBalancerProps) {
    super(scope, id)
    const { domainName, hostedZone, vpc } = props

    // ACM: Certificate
    const certificate = new certificationManager.Certificate(this, 'Certificate', {
      domainName,
      validation: certificationManager.CertificateValidation.fromDns(hostedZone),
    })

    // Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', { vpc })
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(HTTP))
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(HTTPS))

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      internetFacing: true,
      securityGroup,
      vpc,
    })
    alb.logAccessLogs(props.logBucket)

    // ALB: Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      port: HTTP,
      stickinessCookieDuration: cdk.Duration.days(1),
      targetType: elbv2.TargetType.IP,
      vpc,
    })

    // ALB: HTTPS Listener
    alb.addListener('HttpsListener', {
      certificates: [certificate],
      defaultTargetGroups: [targetGroup],
      port: HTTPS,
      protocol: elbv2.ApplicationProtocol.HTTPS,
    })

    // ALB: HTTP Listener
    const httpListener = alb.addListener('HttpListener', {
      defaultTargetGroups: [targetGroup],
      port: HTTP,
      protocol: elbv2.ApplicationProtocol.HTTP,
    })

    // ALB: HTTP Listener Rule - Redirect to HTTPS
    new elbv2.ApplicationListenerRule(this, 'HttpListenerRule', {
      action: elbv2.ListenerAction.redirect({
        permanent: true,
        port: HTTPS.toString(),
        protocol: elbv2.ApplicationProtocol.HTTPS,
      }),
      conditions: [elbv2.ListenerCondition.pathPatterns(['*'])],
      listener: httpListener,
      priority: 1,
    })

    // Route 53: A/AAAA Record to ALB
    const recordProps: route53.ARecordProps & route53.AaaaRecordProps = {
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
      zone: hostedZone,
    }
    new route53.ARecord(this, 'ARecord', recordProps)
    new route53.AaaaRecord(this, 'AaaaRecord', recordProps)

    // Assign to class properties
    this.targetGroupArn = targetGroup.targetGroupArn
  }
}
