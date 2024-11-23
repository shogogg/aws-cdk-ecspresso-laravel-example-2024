// ECR ホスト
local ecrHost = '${APP_AWS_ACCOUNT}.dkr.ecr.${APP_AWS_REGION}.amazonaws.com';

// コンテナイメージの共通プレフィクス
local imagePrefix = ecrHost + '/aws-cdk-ecspresso-laravel-example-2024';

// コンテナイメージ名を返す関数
local image (name) = imagePrefix + '/' + name + ':{{ env `TAG` `latest` }}';

// ログ設定を返す関数
local logConfiguration (prefix) = {
  logDriver: 'awslogs',
  options: {
    'awslogs-group': '/ecs/${APP_ECS_SERVICE_NAME}/' + prefix,
    'awslogs-region': '${APP_AWS_REGION}',
    'awslogs-stream-prefix': prefix,
  },
};

// See https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task_definition_parameters.html
{
  family: '${APP_ECS_CLUSTER_NAME}-service-task-definition',
  cpu: '256',
  memory: '1024',
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  executionRoleArn: '{{ cfn_output `${APP_STACK_NAME}` `EcsTaskExecutionRoleArn` }}',
  containerDefinitions: [
    {
      name: 'app-server',
      image: image('app-server-prod'),
      essential: true,
      logConfiguration: logConfiguration('app-server'),
    },
    {
      name: 'nginx',
      image: image('nginx-prod'),
      essential: true,
      logConfiguration: logConfiguration('nginx'),
      portMappings: [
        {
          containerPort: 8080,
          protocol: 'tcp',
        },
      ],
      dependsOn: [
        {
          containerName: 'app-server',
          condition: 'START',
        },
      ],
      volumesFrom: [
        {
          sourceContainer: 'app-server',
          readOnly: true,
        },
      ],
    },
  ],
}
