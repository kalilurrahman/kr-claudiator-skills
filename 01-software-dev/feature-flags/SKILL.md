---
name: feature-flags
description: Design and implement a feature flag system for safe, gradual feature rollouts. Covers flag types, targeting rules, lifecycle management, technical implementation, and cleanup processes.
argument-hint: [tech stack, rollout strategy, user targeting needs, flag management tool]
allowed-tools: Read, Write, Bash
---

# Feature Flag System

Feature flags (also called feature toggles) decouple code deployment from feature release. They enable dark launches, gradual rollouts, A/B testing, kill switches, and ops toggles — without deploying new code. Done well, they are a superpower. Done poorly, they become a maintenance nightmare.

## Flag Types

| Type | Purpose | Lifetime | Example |
|------|---------|----------|---------|
| Release flag | Progressive rollout of new feature | Short (days–weeks) | New checkout flow for 10% of users |
| Experiment flag | A/B test | Short (test duration) | Button color test |
| Ops/kill switch | Disable feature without deploy | Medium | Disable recommendations under load |
| Permission flag | Feature available to specific users | Long | Beta feature for paid plan only |
| Infrastructure flag | Switch between implementations | Medium | New payment processor |

## Rollout Strategies

```
1. Internal only    → Engineers, QA team, internal accounts
2. Alpha (1–5%)     → Opt-in early adopters or random segment
3. Beta (10–25%)    → Broader rollout; monitor metrics
4. General (50%)    → Half of users; compare to control
5. Full (100%)      → All users; flag can be removed
6. Kill switch      → Instant rollback to 0% without deploy
```

## Process

1. **Name the flag** — use a descriptive, scoped name: `[team]_[feature]_[detail]` e.g. `checkout_new_payment_ui_v2`.
2. **Choose the flag type** — release, experiment, ops, permission.
3. **Define targeting rules** — who gets the feature? Random %, user IDs, plan type, geography.
4. **Set the default** — what does a user get if the flag system is unavailable? Default to safe state.
5. **Implement the flag check** — wrap the feature code, not the business logic.
6. **Test both paths** — always test flag on AND flag off before deploying.
7. **Define rollout stages and success metrics** — what metric validates each stage?
8. **Roll out incrementally** — 1% → 10% → 50% → 100%, monitoring at each stage.
9. **Schedule cleanup** — add a ticket to remove the flag when at 100% for 2+ weeks.
10. **Document flag lifecycle** — who owns it, when it was created, when it expires.

## Implementation Examples

### LaunchDarkly (Managed Service)

```python
import ldclient
from ldclient.config import Config

ldclient.set_config(Config("sdk-key-XXXXXXXX"))
client = ldclient.get()

def show_new_checkout(user_id: str, user_plan: str) -> bool:
    context = {
        "kind": "user",
        "key": user_id,
        "plan": user_plan,
        "custom": {"region": "us-east"}
    }
    return client.variation("checkout-new-ui", context, False)  # False = safe default

# Usage
if show_new_checkout(request.user.id, request.user.plan):
    return render_new_checkout()
else:
    return render_legacy_checkout()
```

### Self-Hosted (Redis + Python)

```python
import redis
import hashlib

r = redis.Redis(host='redis', port=6379, db=0)

class FeatureFlags:
    def __init__(self):
        self.redis = r
        self._cache = {}

    def is_enabled(self, flag_name: str, user_id: str = None) -> bool:
        try:
            flag = self._get_flag(flag_name)
            if not flag:
                return False                    # unknown flag → off
            if flag['status'] == 'off':
                return False
            if flag['status'] == 'on':
                return True
            if flag['status'] == 'rollout':
                return self._in_rollout(flag_name, user_id, flag['percentage'])
        except Exception:
            return False                        # redis down → safe default

    def _get_flag(self, name: str) -> dict:
        raw = self.redis.hgetall(f"flag:{name}")
        if not raw:
            return None
        return {k.decode(): v.decode() for k, v in raw.items()}

    def _in_rollout(self, flag: str, user_id: str, pct: str) -> bool:
        # Consistent hashing — same user always gets same result
        hash_val = int(hashlib.md5(f"{flag}:{user_id}".encode()).hexdigest(), 16)
        return (hash_val % 100) < int(pct)

flags = FeatureFlags()

# Set a flag (via admin UI or script)
r.hset("flag:new_checkout", mapping={
    "status": "rollout",
    "percentage": "10",
    "owner": "checkout-team",
    "created_at": "2025-01-15",
    "expires_at": "2025-03-01",
})
```

### React Client-Side Flag

```typescript
import { useFlags } from 'launchdarkly-react-client-sdk';

function CheckoutPage() {
  const { newCheckoutUi } = useFlags();

  return newCheckoutUi
    ? <NewCheckout />
    : <LegacyCheckout />;
}

// Or with a custom hook that reads from your API
function useFlag(flagName: string, defaultValue = false): boolean {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    fetch(`/api/flags/${flagName}?user_id=${userId}`)
      .then(r => r.json())
      .then(d => setValue(d.enabled))
      .catch(() => setValue(defaultValue));  // network error → safe default
  }, [flagName]);
  return value;
}
```

### Flag Lifecycle Management

```yaml
# Flag registry entry (YAML config or database)
flags:
  checkout_new_payment_ui_v2:
    type: release
    owner: checkout-team
    status: rollout          # off | rollout | on
    percentage: 25
    targeting:
      - rule: plan == "pro"
        serve: true          # all pro users get it regardless of percentage
      - rule: internal_user == true
        serve: true
    default: false
    created: 2025-01-15
    expires: 2025-04-01      # alert if still exists after this date
    cleanup_ticket: ENG-4521
    metrics:
      primary: checkout_completion_rate
      guardrails: [error_rate, p95_latency]
```

### Flag Evaluation Middleware (Express)

```javascript
// Attach flag context to every request
app.use(async (req, res, next) => {
  req.flags = {
    async get(flagName) {
      return flags.isEnabled(flagName, {
        userId: req.user?.id,
        plan:   req.user?.plan,
        region: req.headers['cf-ipcountry'],
      });
    }
  };
  next();
});

// Usage in route handler
app.get('/checkout', async (req, res) => {
  const useNewUI = await req.flags.get('checkout_new_payment_ui_v2');
  res.render(useNewUI ? 'checkout-v2' : 'checkout-v1');
});
```

## Targeting Rules Examples

```python
# Rule engine for targeting
def evaluate_rules(flag: dict, context: dict) -> bool | None:
    for rule in flag.get('rules', []):
        if matches(rule['condition'], context):
            return rule['serve']
    return None  # no rule matched; fall through to percentage rollout

def matches(condition: str, context: dict) -> bool:
    # Simple rule DSL
    # "plan == pro"  → context['plan'] == 'pro'
    # "country in [US, CA]" → context['country'] in ['US', 'CA']
    # "email ends_with @company.com"
    field, op, value = condition.split(None, 2)
    ctx_val = context.get(field)
    if op == '==':     return str(ctx_val) == value
    if op == '!=':     return str(ctx_val) != value
    if op == 'in':     return str(ctx_val) in value.strip('[]').split(',')
    if op == 'ends_with': return str(ctx_val or '').endswith(value)
    return False
```

## Cleanup Process

```bash
# Find flags that have been at 100% for >2 weeks and should be cleaned up
SELECT flag_name, reached_100_at, owner
FROM feature_flags
WHERE percentage = 100
  AND reached_100_at < NOW() - INTERVAL '14 days'
  AND status = 'on'
ORDER BY reached_100_at;

# Flag cleanup PR checklist:
# [ ] Remove all flag.is_enabled('flag_name') checks
# [ ] Remove both branches — keep only the "on" path
# [ ] Delete flag from registry/dashboard
# [ ] Update tests — remove flag context from fixtures
# [ ] Deploy and verify
# [ ] Close cleanup ticket
```

## Monitoring and Alerts

```python
# Track flag evaluation metrics
from prometheus_client import Counter

flag_evaluations = Counter(
    'feature_flag_evaluations_total',
    'Feature flag evaluations',
    ['flag_name', 'result', 'targeting_rule']
)

# Alert: flag at 100% for too long (should be cleaned up)
# feature_flag_rollout_percentage{flag="X"} == 100 for > 14 days → alert

# Alert: flag evaluation errors (flag service unavailable)
# feature_flag_errors_total > 0 → alert
```

## Stale Flag Detection

```python
def find_stale_flags():
    # Grep code for flag references
    used = set()
    for file in glob('**/*.py'):
        with open(file) as f:
            matches = re.findall(r"is_enabled\(['\"]([^'\"]+)", f.read())
            used.update(matches)
    
    db_flags = {f.name for f in FeatureFlag.all()}
    return db_flags - used
```

## Targeting Strategies

### Percentage Rollout
```python
def is_enabled_percentage(flag: str, user_id: str, pct: int) -> bool:
    import hashlib
    hash_val = int(hashlib.md5(f"{flag}:{user_id}".encode()).hexdigest(), 16)
    return (hash_val % 100) < pct
```

### User Whitelist
```yaml
beta_feature:
  whitelist: [user_123, user_456]
```

### Attribute-Based
```yaml
premium_feature:
  rules:
    - if: user.tier == 'premium'
      then: enabled
    - if: user.country in ['US','CA']
      then: enabled
```

---

## Kill Switches

```python
@app.route('/admin/flags/<flag>/disable', methods=['POST'])
@require_admin
def kill_switch(flag):
    flag_obj.enabled = False
    flag_obj.rollout_percentage = 0
    cache.delete(f"flag:{flag}")
    audit_log.record('emergency_disable', flag)
```

### Auto-Disable on High Error Rate
```python
if error_rate > 0.1:
    flags.emergency_disable('problematic_feature')
    alert('Feature auto-disabled: 10% error rate')
```

---

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Flag explosion | 200+ flags; nobody knows what each does | Expiry dates; cleanup tickets; registry with owners |
| No default value | Flag service outage causes unhandled path | Always define a safe default |
| Business logic inside flag | Flag check coupled to logic; hard to remove | Wrap the feature boundary, not the logic |
| Never cleaning up | Technical debt; confusing code | Cleanup ticket created when flag is created |
| Testing only the on path | Off path broken silently | CI tests must cover both flag states |
| Flags without metrics | No way to know if rollout is safe | Define primary metric before launch |

## Rules

- **Name flags descriptively** — `new_checkout_ui_v2` not `flag_123`; include the team, feature, and version.
- **Always define a default** — the default must be the safe, current behavior; never an exception state.
- **Test both flag states in CI** — flag=off must be as tested as flag=on.
- **Use consistent hashing for percentage rollouts** — the same user must always get the same experience.
- **Create the cleanup ticket when you create the flag** — not after the rollout; flags must have expiry accountability.
- **Monitor metrics at each rollout stage** — do not advance to 100% without reviewing the primary metric.
- **Kill switches default to off** — ops toggles that disable a feature must default to feature-enabled (flag=off means feature=on).
- **Never nest flags** — `if flagA and flagB` creates 4 code paths; design features to need one flag each.
- **Flags are temporary** — if a flag is permanent, it is a configuration option, not a feature flag.
- **Flag service failure must be safe** — your application must work if LaunchDarkly or your Redis is down.
