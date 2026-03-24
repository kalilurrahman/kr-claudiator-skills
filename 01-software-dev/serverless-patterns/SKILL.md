---
name: serverless-patterns
description: Design serverless architectures with functions, managed services, and event triggers. Outputs function decomposition, cold start mitigation, cost model, and IaC templates for AWS Lambda or similar.
argument-hint: [cloud provider, workload type, latency requirements, expected invocation volume]
allowed-tools: Read, Write
---

# Serverless Patterns

Serverless shifts operational burden from you to the cloud provider. You write functions; they handle scaling, patching, and availability. The trade-offs are real: cold starts, 15-minute execution limits, statelessness, and per-invocation cost at scale.

## Process

1. **Identify workload fit.** Serverless excels at event-driven, bursty, or infrequent workloads. Avoid for long-running processes or steady high-throughput (cost exceeds containers).
2. **Decompose by trigger type.** HTTP (API Gateway), queue (SQS), stream (Kinesis/DynamoDB Streams), schedule (EventBridge), storage (S3 events).
3. **Design function boundaries.** Single responsibility. Each function does one thing. Avoid monolithic "nano-services" that couple everything.
4. **Model cold starts.** Identify latency-sensitive paths. Apply warming strategies or provisioned concurrency.
5. **Design state management.** Functions are stateless. State goes in DynamoDB, S3, ElastiCache, or Step Functions.
6. **Handle failures.** Configure retries, DLQs, and idempotency for every async trigger.
7. **Set concurrency limits.** Reserve concurrency for critical functions. Throttle to protect downstream.
8. **Cost model.** Estimate invocations × duration × memory. Compare to always-on containers at target load.

## Function Design

```python
# AWS Lambda — production-ready handler pattern
import json
import os
import logging
from typing import Any

logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialise outside handler — runs once per container (warm start reuses)
from services import OrderService, PaymentService
order_service = OrderService(table_name=os.environ['ORDERS_TABLE'])
payment_service = PaymentService(api_key=os.environ['PAYMENT_API_KEY'])

def handler(event: dict, context: Any) -> dict:
    """
    Triggered by: API Gateway POST /orders
    """
    correlation_id = event.get('headers', {}).get('x-correlation-id', context.aws_request_id)
    logger.info("Processing order", extra={
        "correlation_id": correlation_id,
        "request_id": context.aws_request_id,
    })
    
    try:
        body = json.loads(event.get('body', '{}'))
        result = order_service.place_order(body, correlation_id=correlation_id)
        return _response(201, result)
    
    except ValidationError as e:
        return _response(400, {"error": str(e)})
    except Exception as e:
        logger.exception("Unexpected error", extra={"correlation_id": correlation_id})
        return _response(500, {"error": "Internal error", "request_id": context.aws_request_id})

def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "X-Request-Id": "",
        },
        "body": json.dumps(body),
    }
```

## SAM / Serverless Framework IaC

```yaml
# template.yaml (AWS SAM)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: python3.12
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        LOG_LEVEL: INFO
        ORDERS_TABLE: !Ref OrdersTable
    Layers:
      - !Ref DependenciesLayer
    Tracing: Active  # X-Ray

Resources:
  PlaceOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers.orders.handler
      ReservedConcurrentExecutions: 100  # Limit blast radius
      Events:
        Api:
          Type: Api
          Properties:
            Path: /orders
            Method: post
            RestApiId: !Ref OrdersApi
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
        - SQSSendMessagePolicy:
            QueueName: !GetAtt OrderEventsQueue.QueueName

  ProcessOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers.processor.handler
      Timeout: 300  # 5 min for batch processing
      Events:
        Queue:
          Type: SQS
          Properties:
            Queue: !GetAtt OrderEventsQueue.Arn
            BatchSize: 10
            FunctionResponseTypes:
              - ReportBatchItemFailures  # Partial batch failure handling
      DeadLetterQueue:
        Type: SQS
        TargetArn: !GetAtt OrderEventsDLQ.Arn

  OrdersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
```

## Cold Start Mitigation

```python
# Strategy 1: Keep initialisation outside handler (already shown above)
# Expensive imports, DB connections, config loading → module level

# Strategy 2: Provisioned concurrency (for latency-critical paths)
# In SAM:
PlaceOrderFunction:
  Type: AWS::Serverless::Function
  Properties:
    AutoPublishAlias: live
    ProvisionedConcurrencyConfig:
      ProvisionedConcurrentExecutions: 5

# Strategy 3: Warming schedule (cheaper than provisioned)
WarmingFunction:
  Type: AWS::Serverless::Function
  Properties:
    Events:
      Warming:
        Type: Schedule
        Properties:
          Schedule: rate(5 minutes)
          Input: '{"warming": true}'

def handler(event, context):
    if event.get('warming'):
        logger.info("Warming ping — returning early")
        return {"statusCode": 200}
    # ... real logic

# Strategy 4: Snap Start (Java on Lambda)
# snapStart: ApplyOn: PublishedVersions
# Takes snapshot after init, restores instead of cold-starting

# Cold start times by runtime (approximate):
# Python: 200-500ms
# Node.js: 100-300ms
# Java (without SnapStart): 1-3s
# Java (with SnapStart): 100-200ms
# Go: 50-150ms
```

## Step Functions — Orchestration

```json
{
  "Comment": "Order processing workflow",
  "StartAt": "ValidateOrder",
  "States": {
    "ValidateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123:function:ValidateOrder",
      "Retry": [{ "ErrorEquals": ["Lambda.ServiceException"], "MaxAttempts": 3, "IntervalSeconds": 2 }],
      "Catch": [{ "ErrorEquals": ["ValidationError"], "Next": "OrderRejected" }],
      "Next": "ReserveInventory"
    },
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "Next": "ChargePayment"
    },
    "ChargePayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123:function:ChargePayment",
      "Catch": [{ "ErrorEquals": ["PaymentFailed"], "Next": "ReleaseInventory" }],
      "Next": "SendConfirmation"
    },
    "SendConfirmation": { "Type": "Task", "Resource": "...", "Next": "OrderComplete" },
    "ReleaseInventory": { "Type": "Task", "Resource": "...", "Next": "OrderFailed" },
    "OrderComplete": { "Type": "Succeed" },
    "OrderFailed":  { "Type": "Fail", "Cause": "Payment failed" },
    "OrderRejected":{ "Type": "Fail", "Cause": "Validation failed" }
  }
}
```

## Cost Model

```
Lambda cost (us-east-1):
  Requests: $0.20 per 1M
  Duration: $0.0000166667 per GB-second

Example: 1M requests/month, 512MB, 200ms avg duration
  Request cost: $0.20
  Duration: 1,000,000 × 0.5 GB × 0.2s = 100,000 GB-s × $0.0000166667 = $1.67
  Total: ~$1.87/month

vs ECS Fargate (always-on, 0.5 vCPU, 1GB):
  $0.04048/vCPU-hr × 720hr = $29.15 + memory = ~$38/month

Break-even: Lambda is cheaper until ~sustained 10-15% CPU utilisation
At 100% utilisation (steady throughput): containers win by 10-20×
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Lambdalith** | Single function handling all routes | One function per route or domain boundary |
| **Synchronous fan-out** | Lambda calling 10 other Lambdas synchronously | Use Step Functions or async SQS fan-out |
| **Secrets in env vars** | Visible in console, rotated with redeployment | AWS Secrets Manager or Parameter Store |
| **No DLQ on async triggers** | Failed events silently dropped | DLQ on every SQS/SNS/EventBridge trigger |
| **Non-idempotent handlers** | SQS delivers at-least-once; duplicate causes double charge | Idempotency key in DynamoDB |
| **Unbounded concurrency** | 1000 concurrent functions overwhelm RDS | Reserved concurrency + RDS Proxy |
| **Long polling loops** | Lambda sleeping waiting for work | Use SQS trigger instead |
| **Ignoring timeout** | Default 3s timeout causes mysterious failures | Set timeout to 2× p99 execution time |

## 10 Rules

1. Keep handler logic thin — initialise dependencies at module level, process in handler.
2. Every async trigger needs a DLQ and alerting on DLQ depth.
3. Functions must be idempotent — at-least-once delivery is the default for async triggers.
4. Set explicit memory, timeout, and concurrency limits — never leave defaults in production.
5. Store all state externally — DynamoDB, S3, ElastiCache. Functions are stateless.
6. Use Step Functions for workflows with branching, retries, or state — not chained Lambdas.
7. Trace every invocation with correlation IDs propagated through event payloads.
8. Cost model before committing — serverless is cheap at low scale, expensive at sustained high throughput.
9. Separate hot (latency-sensitive) from cold (batch) paths and size them independently.
10. Treat Lambda layers as shared libraries — version them, don't mutate them in place.
