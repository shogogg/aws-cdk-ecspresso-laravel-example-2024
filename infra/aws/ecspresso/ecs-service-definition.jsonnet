{
  launchType: 'FARGATE',
  platformFamily: 'LINUX',
  platformVersion: '1.4.0',
  serviceName: '${APP_ECS_SERVICE_NAME}',
  desiredCount: 2,
  networkConfiguration: {
    awsvpcConfiguration: {
      subnets: [
        '{{ cfn_output `${APP_STACK_NAME}` `PrivateSubnetAz1` }}',
        '{{ cfn_output `${APP_STACK_NAME}` `PrivateSubnetAz2` }}',
      ],
      securityGroups: ['{{ cfn_output `${APP_STACK_NAME}` `EcsSecurityGroupId` }}'],
      assignPublicIp: 'DISABLED',
    },
  },
  loadBalancers: [
    {
      containerName: 'nginx',
      containerPort: 8080,
      targetGroupArn: '{{ cfn_output `${APP_STACK_NAME}` `AlbTargetGroupArn` }}',
    },
  ],
  enableExecuteCommand: false,
}
