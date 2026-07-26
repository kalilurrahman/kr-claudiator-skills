---
name: api-gateway-design
description: Design and configure an API gateway for routing, authentication, rate limiting, and observability. Outputs gateway architecture, routing rules, plugin configuration, and operational runbook.
argument-hint: [backend services, traffic volume, auth requirements, cloud provider, existing infrastructure]
allowed-tools: Read, Write
---

# API Gateway Design

An API gateway is the single entry point for all client requests. It handles cross-cutting concerns — authentication, rate limiting, routing, SSL termination, request transformation — so individual services don't have to. Every client-facing API should go through a gateway.

## Gateway Responsibilities

```
Client → API Gateway → Upstream Services

Gateway handles:
  ✓ TLS termination
  ✓ Authentication (JWT validation, API key verification)
  ✓ Rate limiting (per client, per endpoint)
  ✓ Request routing (by path, header, method)
  ✓ Request/response transformation
  ✓ Load balancing across service instances
  ✓ Circuit breaking to unhealthy upstreams
  ✓ Observability (access logs, metrics, traces)
  ✗ Business logic (that stays in services)
  ✗ Database access
  ✗ Domain-specific validation
```

## Kong Gateway Configuration

```yaml
# kong.yaml — declarative configuration
_format_version: "3.0"

services:
  - name: orders-api
    url: http://orders-service:8080
    connect_timeout: 5000
    write_timeout: 10000
    read_timeout: 10000
    retries: 2
    routes:
      - name: orders-routes
        paths: ["/api/v1/orders"]
        methods: [GET, POST, PUT, PATCH, DELETE]
        strip_path: false
        protocols: [https]

  - name: products-api
    url: http://products-service:8080
    routes:
      - name: products-routes
        paths: ["/api/v1/products"]
        methods: [GET]
        strip_path: false

  - name: auth-api
    url: http://auth-service:8080
    routes:
      - name: auth-routes
        paths: ["/api/v1/auth"]
        strip_path: false

# Global plugins (apply to all routes)
plugins:
  - name: jwt
    config:
      header_names: [authorization]
      claims_to_verify: [exp, nbf]
      key_claim_name: kid
    route: null  # Global

  - name: rate-limiting
    config:
      minute: 100        # Per consumer per minute
      hour: 1000
      policy: redis
      redis_host: redis
      redis_port: 6379
    route: null

  - name: prometheus
    config:
      per_consumer: true
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true

  - name: correlation-id
    config:
      header_name: X-Correlation-ID
      generator: uuid
      echo_downstream: true

  - name: response-transformer
    config:
      remove:
        headers: [Server, X-Powered-By]  # Remove fingerprinting headers

# Route-specific overrides
  - name: rate-limiting
    route: products-routes
    config:
      minute: 1000       # Higher limit for read-only products
      hour: 10000

  - name: rate-limiting
    route: auth-routes
    config:
      minute: 10         # Strict limit on auth endpoints
      hour: 50
      error_message: "Too many login attempts. Try again later."
```

## AWS API Gateway (Terraform)

```hcl
resource "aws_api_gateway_rest_api" "main" {
  name        = "production-api"
  description = "Production API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# JWT Authorizer
resource "aws_api_gateway_authorizer" "jwt" {
  name                   = "jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  type                   = "TOKEN"
  authorizer_uri         = aws_lambda_function.jwt_authorizer.invoke_arn
  authorizer_result_ttl_in_seconds = 300
  identity_source        = "method.request.header.Authorization"
}

# Lambda Authorizer (JWT validation)
resource "aws_lambda_function" "jwt_authorizer" {
  filename      = "authorizer.zip"
  function_name = "api-jwt-authorizer"
  role          = aws_iam_role.authorizer.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 5

  environment {
    variables = {
      JWKS_URL  = "https://auth.example.com/.well-known/jwks.json"
      AUDIENCE  = "api.example.com"
      ISSUER    = "https://auth.example.com"
    }
  }
}

# WAF (rate limiting + OWASP rules)
resource "aws_wafv2_web_acl" "api" {
  name  = "api-waf"
  scope = "REGIONAL"

  default_action { allow {} }

  rule {
    name     = "RateLimitPerIP"
    priority = 1
    action   { block {} }
    
    statement {
      rate_based_statement {
        limit              = 1000  # Per 5-minute window
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    override_action { none {} }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRules"
      sampled_requests_enabled   = true
    }
  }
}

# Associate WAF with API Gateway
resource "aws_wafv2_web_acl_association" "api" {
  resource_arn = aws_api_gateway_stage.main.arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}

# Usage plan with throttling
resource "aws_api_gateway_usage_plan" "default" {
  name = "default"

  throttle_settings {
    burst_limit = 500   # Max concurrent requests
    rate_limit  = 100   # Requests per second
  }

  quota_settings {
    limit  = 10000
    period = "DAY"
  }

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }
}
```

## Request Routing Patterns

```yaml
# Advanced routing examples (Kong)

# Route by header (e.g., API version)
- name: orders-v2
  service: orders-api-v2
  headers:
    API-Version: ["2"]
  paths: ["/api/v1/orders"]

# Route by query parameter (feature flag)
- name: orders-beta
  service: orders-api-beta
  paths: ["/api/v1/orders"]
  # Add routing plugin to check ?beta=true header

# Canary routing (10% to new version)
plugins:
  - name: traffic-split
    route: orders-routes
    config:
      upstreams:
        - upstream: orders-service
          weight: 90
        - upstream: orders-service-v2
          weight: 10
```

## Observability Configuration

```yaml
# Access log format (JSON for parsing)
plugins:
  - name: file-log
    config:
      path: /dev/stdout
      reopen: false
    # Output format:
    # {
    #   "request": {"method": "GET", "url": "/api/v1/orders", "headers": {...}},
    #   "response": {"status": 200, "latency": {"proxy": 45, "gateway": 2}},
    #   "authenticated_entity": {"consumer_id": "..."},
    #   "route": {"name": "orders-routes"},
    #   "started_at": 1710000000000
    # }

# Metrics (Prometheus)
# kong_http_requests_total{service,route,status_code}
# kong_request_latency_ms{service,route,quantile}
# kong_upstream_latency_ms{service}
# kong_bandwidth_bytes{type}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Business logic in gateway** | Gateway becomes fat; hard to test and deploy | Gateway only handles cross-cutting concerns |
| **No circuit breakers to upstreams** | Slow upstream blocks gateway threads | Circuit breaker on each upstream |
| **Single gateway instance** | SPOF; all traffic fails if gateway fails | Multiple instances behind load balancer |
| **No rate limit differentiation** | Premium customers throttled same as free tier | Per-consumer plans with different limits |
| **Ignoring gateway metrics** | Can't detect upstream issues at gateway level | Alert on gateway error rate and p99 latency |
| **Long timeouts** | Slow upstream holds gateway connection | Aggressive timeouts: 5s connect, 10s read |
| **No WAF** | API gateway without WAF is unprotected | WAF with managed ruleset on public APIs |

## 10 Rules

1. Every external API request goes through the gateway — no direct service access from clients.
2. Authentication and rate limiting happen at the gateway — not reimplemented in each service.
3. Gateway timeouts are aggressive — 5s connect, 10s read — slow upstreams are circuit-broken.
4. Multiple gateway instances behind a load balancer — a single gateway is a single point of failure.
5. WAF with managed OWASP rulesets on all public-facing gateways.
6. Rate limits differentiate by consumer tier — free, standard, premium have different limits.
7. Every request gets a correlation ID at the gateway — propagated to all downstream services.
8. Remove server fingerprinting headers (Server, X-Powered-By) at the gateway.
9. Gateway configuration is version-controlled and deployed via CI/CD — no manual changes.
10. Monitor gateway latency separately from upstream latency — gateway overhead should be <5ms.
