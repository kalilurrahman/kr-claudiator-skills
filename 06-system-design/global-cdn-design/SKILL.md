---
name: global-cdn-design
description: Design global CDN architecture for static assets, API caching, and edge computing. Outputs CDN topology, cache rules, origin shield configuration, and performance optimisation strategy.
argument-hint: [content types, global regions, cache hit rate target, dynamic vs static ratio, provider]
allowed-tools: Read, Write
---

# Global CDN Design

A CDN distributes content to edge nodes close to users, reducing latency and origin load. Beyond static assets, modern CDNs handle API response caching, edge compute (middleware at the CDN level), and DDoS protection. Good CDN design defines what to cache, for how long, and how to invalidate efficiently.

## Architecture Layers

```
Users (Global)
     │
     ▼
Edge Nodes (150-300 PoPs worldwide)
  └── Cache hit → serve immediately (1-5ms)
  └── Cache miss ↓
     │
     ▼
Origin Shield (1-3 regional nodes)
  └── Absorbs origin requests from all edges
  └── Cache hit → serve to edge
  └── Cache miss ↓
     │
     ▼
Origin (Your infrastructure)
  └── Only handles requests that miss both edge + shield
```

## Cache Rules by Content Type

```nginx
# Cloudflare / CDN cache rules (Page Rules or Cache Rules)

# Static assets — long TTL, versioned by content hash
/static/*          Cache-Control: public, max-age=31536000, immutable
/_next/static/*    Cache-Control: public, max-age=31536000, immutable
/assets/*          Cache-Control: public, max-age=31536000, immutable

# Product pages — medium TTL, stale-while-revalidate
/products/*        Cache-Control: public, max-age=300, stale-while-revalidate=3600
/categories/*      Cache-Control: public, max-age=600, stale-while-revalidate=7200

# API responses — short TTL where safe
/api/v1/products   Cache-Control: public, max-age=60, s-maxage=120
/api/v1/pricing    Cache-Control: no-cache  # Never cache (personalised)
/api/v1/cart       Cache-Control: private   # User-specific

# HTML pages — edge cache with validation
/                  Cache-Control: public, s-maxage=300, must-revalidate
/*.html            Cache-Control: public, s-maxage=600, stale-while-revalidate=86400

# Never cache
/api/v1/auth/*     Cache-Control: no-store, private
/api/v1/orders/*   Cache-Control: no-store, private
/api/v1/checkout/* Cache-Control: no-store, private
```

## Terraform — CloudFront Distribution

```hcl
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  # Origin: S3 for static
  origin {
    domain_name = aws_s3_bucket.static.bucket_regional_domain_name
    origin_id   = "S3-static"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.static.cloudfront_access_identity_path
    }
  }
  
  # Origin: ALB for dynamic API
  origin {
    domain_name = aws_lb.api.dns_name
    origin_id   = "ALB-api"
    
    # Origin Shield — reduce origin requests
    origin_shield {
      enabled              = true
      origin_shield_region = "us-east-1"  # Closest to your origin
    }
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    
    custom_header {
      name  = "X-Origin-Verify"
      value = var.origin_secret  # Prove request came through CDN
    }
  }
  
  # Default: static assets
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-static"
    compress         = true
    
    cache_policy_id            = aws_cloudfront_cache_policy.static.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    
    viewer_protocol_policy = "redirect-to-https"
  }
  
  # API: dynamic with short cache
  ordered_cache_behavior {
    path_pattern     = "/api/v1/products*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-api"
    compress         = true
    
    cache_policy_id = aws_cloudfront_cache_policy.api_short.id
    
    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 60
    max_ttl                = 300
  }
  
  # Never cache: auth, cart, checkout
  ordered_cache_behavior {
    path_pattern     = "/api/v1/auth*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-api"
    
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Cookie"]
      cookies { forward = "all" }
    }
    
    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }
  
  # WAF
  web_acl_id = aws_wafv2_web_acl.main.arn
  
  price_class = "PriceClass_100"  # US+EU only; All = worldwide
  
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_cache_policy" "static" {
  name        = "static-assets"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 86400
  
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config  { cookie_behavior = "none" }
    headers_config  { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}
```

## Cache Invalidation

```python
import boto3
import time

class CDNInvalidator:
    def __init__(self, distribution_id: str):
        self.cf = boto3.client('cloudfront')
        self.distribution_id = distribution_id
    
    def invalidate(self, paths: list, wait: bool = False) -> str:
        """Invalidate specific paths. Costs $0.005/path after first 1000/month."""
        response = self.cf.create_invalidation(
            DistributionId=self.distribution_id,
            InvalidationBatch={
                'Paths': {
                    'Quantity': len(paths),
                    'Items': paths,  # e.g. ['/products/*', '/api/v1/products/123']
                },
                'CallerReference': str(time.time()),
            }
        )
        invalidation_id = response['Invalidation']['Id']
        
        if wait:
            waiter = self.cf.get_waiter('invalidation_completed')
            waiter.wait(
                DistributionId=self.distribution_id,
                Id=invalidation_id,
            )
        return invalidation_id
    
    def invalidate_product(self, product_id: str):
        """Invalidate all cached representations of a product."""
        self.invalidate([
            f'/products/{product_id}',
            f'/products/{product_id}/*',
            f'/api/v1/products/{product_id}',
            f'/api/v1/products/{product_id}*',
        ])

# Avoid: invalidating /* on every deploy — costs money and defeats caching
# Better: use cache-busting via content hash in asset filenames
# /static/app.a3b4c5d6.js  ← hash in filename, 1-year TTL, no invalidation needed
```

## Edge Computing (Cloudflare Workers)

```javascript
// Cloudflare Worker — run logic at the CDN edge
// Use case: A/B testing, auth at edge, personalised responses, geo-routing

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Geo-based routing to nearest origin
  const country = request.cf?.country;
  const region = getRegion(country);
  const originUrl = `https://${region}.api.example.com${url.pathname}${url.search}`;
  
  // Add security headers at edge
  const response = await fetch(originUrl, {
    headers: {
      ...Object.fromEntries(request.headers),
      'X-Country': country,
      'X-Region': region,
      'X-Origin-Verify': ORIGIN_SECRET,  // From Worker secret
    }
  });
  
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.delete('Server');
  
  return newResponse;
}

function getRegion(country) {
  const EU = ['GB','DE','FR','NL','SE','IT','ES','PL'];
  const APAC = ['JP','SG','AU','IN','KR','TW'];
  if (EU.includes(country)) return 'eu-west-1';
  if (APAC.includes(country)) return 'ap-southeast-1';
  return 'us-east-1';
}
```

## Cache Hit Rate Monitoring

```python
# Target: >90% cache hit rate for static, >50% for dynamic API

# CloudFront metrics in CloudWatch
import boto3
from datetime import datetime, timedelta

def get_cache_hit_rate(distribution_id: str, hours: int = 24) -> float:
    cw = boto3.client('cloudwatch', region_name='us-east-1')
    end = datetime.utcnow()
    start = end - timedelta(hours=hours)
    
    def get_metric(metric_name):
        resp = cw.get_metric_statistics(
            Namespace='AWS/CloudFront',
            MetricName=metric_name,
            Dimensions=[{'Name': 'DistributionId', 'Value': distribution_id}],
            StartTime=start, EndTime=end,
            Period=3600, Statistics=['Sum'],
        )
        return sum(p['Sum'] for p in resp['Datapoints'])
    
    hits = get_metric('CacheHits')
    misses = get_metric('CacheMisses')
    total = hits + misses
    
    hit_rate = hits / total if total > 0 else 0
    print(f"Cache hit rate: {hit_rate:.1%} ({hits:,.0f} hits / {total:,.0f} total)")
    return hit_rate
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Caching personalised content** | User A sees User B's data | `Cache-Control: private` for user-specific responses |
| **No cache-busting for static assets** | Users get stale JS/CSS after deploy | Content hash in filename (`app.abc123.js`) |
| **Invalidating /* on deploy** | Expensive; momentary cache empty | Versioned filenames; invalidate only changed paths |
| **Caching errors** | 500 errors cached and served to all users | Set `Cache-Control: no-store` on error responses |
| **No origin shield** | Every edge miss hits origin directly | Origin shield collapses requests to single origin hit |
| **Forgetting to strip cookies** | Cookie variation prevents caching | Strip cookies from cache key for public content |
| **HTTP allowed** | Mixed content, downgrade attacks | Redirect to HTTPS; `Strict-Transport-Security` header |

## 10 Rules

1. Static assets use content-hash filenames and 1-year TTL — never need invalidation.
2. Never cache user-specific, auth-gated, or payment content — `Cache-Control: private` or `no-store`.
3. `stale-while-revalidate` gives freshness without latency — CDN serves stale while fetching fresh.
4. Origin shield is mandatory for high-traffic sites — prevents thundering herd on cache miss.
5. Monitor cache hit rate per path — below 50% for cacheable content means misconfigured rules.
6. Security headers (HSTS, CSP, X-Frame-Options) belong at the CDN — one place, applies everywhere.
7. Invalidation is expensive and slow — design to avoid it through versioning and short TTLs.
8. Validate `X-Origin-Verify` header at origin — reject direct requests bypassing CDN.
9. Edge compute (Workers/Lambda@Edge) for auth, A/B, and geo-routing — keep logic out of origin.
10. Test CDN cache behaviour from multiple regions — `curl -I` and check `X-Cache` response header.
