---
name: code-review
description: Conduct a thorough, structured code review covering correctness, security, performance, maintainability, and design. Produces inline comments organized by severity with actionable, constructive feedback.
argument-hint: [PR description, tech stack, review focus area, team norms]
allowed-tools: Read, Write, Bash
---

# Code Review

Code review is the primary mechanism for sharing knowledge, catching defects early, and maintaining codebase quality. A good review is specific, constructive, and prioritized. The reviewer's goal is to make the code better, not to find fault. A great review improves the author's skills in addition to the code.

## Review Checklist

### Correctness
- [ ] Does the code do what the PR description says?
- [ ] Are edge cases handled (empty collections, nulls, zero, negative numbers, max values)?
- [ ] Are error cases handled and communicated clearly to callers?
- [ ] Is concurrent access safe (race conditions, shared mutable state)?
- [ ] Are external dependencies (APIs, DBs) assumed reliable? Should they be?
- [ ] Are type conversions safe? Integer overflow? Float precision?

### Security
- [ ] Is user input validated and sanitized before use?
- [ ] Are SQL queries parameterized (no string interpolation)?
- [ ] Are secrets hardcoded anywhere?
- [ ] Is authentication/authorization checked at the right layers?
- [ ] Are file paths validated (path traversal)?
- [ ] Is output escaped appropriately (XSS prevention)?

### Performance
- [ ] Are there N+1 query patterns (loop with DB call inside)?
- [ ] Are large result sets paginated or streamed?
- [ ] Are expensive computations cached where appropriate?
- [ ] Are database indexes used for the new queries?

### Maintainability
- [ ] Is the code readable without needing comments to understand intent?
- [ ] Are function and variable names descriptive?
- [ ] Is the function length reasonable (< 40 lines is a guideline)?
- [ ] Is the complexity manageable (cyclomatic complexity < 10)?
- [ ] Are magic numbers replaced with named constants?

### Tests
- [ ] Are new code paths covered by tests?
- [ ] Are edge cases tested?
- [ ] Do test names describe the scenario and expected outcome?
- [ ] Are tests independent (no shared mutable state)?

### Design
- [ ] Does this change fit naturally into the existing architecture?
- [ ] Is the change reversible (no irreversible data migrations without rollback)?
- [ ] Is there a simpler solution that achieves the same goal?

## Comment Severity Labels

Establish a team convention for comment priority:

```
[MUST]     Blocking -- must be addressed before merge
           Bug, security issue, data loss risk, correctness problem

[SHOULD]   Non-blocking but strongly recommended
           Performance issue, maintainability concern, missing test

[COULD]    Optional improvement -- at author's discretion
           Style, naming, minor refactor

[NIT]      Tiny stylistic point -- author may ignore

[QUESTION] Seeking understanding, not requesting change

[PRAISE]   Explicit positive feedback
```

## Output Format

### Inline Comment Examples

```python
# Original code
def get_user_orders(user_id):
    orders = db.query("SELECT * FROM orders WHERE user_id = " + user_id)
    result = []
    for order in orders:
        items = db.query("SELECT * FROM order_items WHERE order_id = " + str(order['id']))
        order['items'] = items
        result.append(order)
    return result
```

**[MUST] SQL Injection vulnerability -- Line 2**
String interpolation in SQL queries allows SQL injection. Any user-controlled `user_id` can modify the query.
```python
# Fix: use parameterized query
orders = db.query("SELECT * FROM orders WHERE user_id = %s", (user_id,))
```

**[MUST] N+1 query problem -- Lines 4-7**
This executes one query per order. With 100 orders this is 101 DB round-trips.
```python
# Fix: fetch all items in one query
order_ids = [o['id'] for o in orders]
items = db.query(
    "SELECT * FROM order_items WHERE order_id = ANY(%s)", (order_ids,)
)
items_by_order = defaultdict(list)
for item in items:
    items_by_order[item['order_id']].append(item)
for order in orders:
    order['items'] = items_by_order[order['id']]
```

**[SHOULD] Missing error handling -- Line 2**
If the database query fails, the exception propagates uncaught. Should this return an empty list, raise a domain exception, or let it propagate? Make the intent explicit.

**[QUESTION] Why `SELECT *`?**
Is the full order record needed here, or a subset? Selecting only needed columns reduces data transfer.

---

### PR-Level Summary Comment

```markdown
## Code Review Summary

**Overall:** Good approach to the problem. The core logic is sound. Two blocking issues to address before merge.

### Must Fix (blocking)
1. **SQL injection** (line 12, 34) -- parameterize all queries
2. **N+1 query** (lines 45-52) -- fetch order items in a single IN query; will cause timeouts at scale

### Recommended
3. **Missing test for empty order list** -- the edge case where user has no orders should be explicitly tested
4. **Error handling on DB failure** -- what should callers receive when the DB is unavailable?

### Optional
5. Consider extracting the item-grouping logic into a helper function for readability

### Positives
- Clean separation between the query and grouping logic
- Good use of type hints throughout
- Test structure is clear and well-named

Approving once the blocking items are resolved.
```

## Giving Feedback Well

### Be specific about the problem, not the person

```
BAD:  "This is wrong."
GOOD: "This will throw a KeyError if 'user' is not in the response dict.
       Use .get('user') with a default, or check for the key first."

BAD:  "I wouldn't do it this way."
GOOD: "This approach works, but loading all 50K records into memory before
       filtering will cause OOM errors for large datasets. Consider filtering
       at the query level instead."
```

### Explain the why

```
BAD:  "Use a list comprehension here."
GOOD: "A list comprehension is more idiomatic Python and typically faster
       for simple transformations: [x.strip() for x in items]"
```

### Distinguish opinions from requirements

```
[NIT] I'd name this `process_payment` rather than `do_payment` -- reads
more naturally. Totally your call.

[MUST] `do_payment` does not convey that it has a side effect (charging the
card). Functions with side effects should be named to reflect the action:
`charge_card`, `create_payment_intent`.
```

### Praise specifically

```
[PRAISE] The way you handled the idempotency key here is really clean --
storing the key before processing and checking it first prevents double-
charges without needing a distributed lock. Worth adding to the docstring.
```

## Review Size Guidelines

| PR size | Expected review time | Max files |
|---------|---------------------|-----------|
| XS (< 50 lines) | 15 min | 3 |
| S (50-200 lines) | 30 min | 10 |
| M (200-500 lines) | 1 hour | 20 |
| L (500+ lines) | 2+ hours; request split | -- |

If a PR takes more than 2 hours to review properly, request it be split.

## Worked Example: Security Review

**PR:** "Add user profile endpoint"

```python
# Submitted code
@app.route('/api/users/<user_id>/profile')
def get_profile(user_id):
    user = User.query.get(user_id)
    return jsonify(user.to_dict())
```

**[MUST] Missing authorization check**
Any authenticated user can retrieve any user's profile by changing the user_id in the URL (IDOR vulnerability). Add an ownership check:
```python
@app.route('/api/users/<user_id>/profile')
@login_required
def get_profile(user_id):
    if str(current_user.id) != str(user_id) and not current_user.is_admin:
        abort(403)
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_public_dict())   # note: use a whitelist of public fields
```

**[MUST] `to_dict()` may expose sensitive fields**
Does `to_dict()` include `password_hash`, `reset_token`, `api_secret`? Use a whitelist method `to_public_dict()` that only returns fields safe to expose.

**[SHOULD] No 404 handling**
`User.query.get(user_id)` returns None for unknown IDs; `to_dict()` then raises AttributeError. Use `get_or_404()`.

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Rubber-stamping | Approving without reading | Block time; use the checklist |
| Style-only reviews | Missing real bugs; author feels nitpicked | Use linters for style; focus on correctness |
| Vague comments | "This could be better" gives nothing | Specific problem + specific fix |
| Blocking on opinions | Personal preference is not a blocker | Use [COULD] or [NIT] |
| No positive feedback | Author only hears problems | Explicitly [PRAISE] good choices |
| Review avalanche | 50 comments overwhelming the author | Prioritize top 5; group related comments |

## Rules

- **Distinguish blockers from suggestions** -- use a severity label on every comment.
- **Be specific** -- every comment must identify a concrete problem and suggest a concrete fix.
- **Explain the why** -- "do X because Y" teaches; "do X" does not.
- **Separate opinions from requirements** -- personal preference is not a blocker.
- **Review the PR description first** -- context changes what counts as correct.
- **Focus on correctness and design** -- use linters for style; do not be a human linter.
- **Respond within one business day** -- slow reviews block the team.
- **Always include positive feedback** -- if you only say what is wrong, authors stop asking for reviews.
- **Request splits on large PRs** -- a 1,000-line PR cannot be reviewed properly.
- **Follow up after changes** -- if you left a [MUST], verify it was addressed before approving.
