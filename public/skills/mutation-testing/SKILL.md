---
name: mutation-testing
description: Use mutation testing to measure and improve the quality of a test suite. Covers mutation operators, interpreting mutation scores, fixing weak tests, and integrating mutation testing into CI with Stryker, PIT, or mutmut.
argument-hint: [language, test framework, current test coverage, mutation score target]
allowed-tools: Read, Write, Bash
---

# Mutation Testing

Mutation testing answers the question that code coverage cannot: do your tests actually detect bugs? It works by automatically introducing small code changes (mutations) — flipping a `>` to `>=`, removing a return statement, negating a condition — and then checking whether the existing tests catch each change. A test suite that misses mutations is not protecting you.

## Why Coverage Alone is Misleading

```python
def is_adult(age: int) -> bool:
    return age >= 18

def test_is_adult():
    assert is_adult(20) == True   # passes; 100% line coverage
```

The test hits every line but fails to catch the mutation `age >= 18` → `age > 18`. Any user aged exactly 18 would be incorrectly rejected. Mutation testing catches this; coverage does not.

## Mutation Operators (what gets changed)

| Operator | Example mutation | What it tests |
|---------|----------------|--------------|
| Relational | `>` → `>=`, `==` → `!=` | Boundary conditions in tests |
| Arithmetic | `+` → `-`, `*` → `/` | Arithmetic correctness |
| Logical | `and` → `or`, `not` removed | Boolean logic coverage |
| Return value | `return x` → `return None` | Return value assertions |
| Constant | `return True` → `return False` | Constant assertions |
| Statement deletion | Remove a line entirely | Whether each line has side effects tested |
| Null / None | `x` → `None` | Null-check coverage |

## Mutation Score

```
Mutation Score = killed_mutants / total_mutants × 100%

Killed:   test suite detected the mutation (test failed as expected — good)
Survived: test suite did NOT detect the mutation (bug that tests missed — bad)
Timeout:  mutation created an infinite loop
Equivalent: mutation is semantically identical (does not change behaviour — ignore)
```

Target scores:
- < 60%: Dangerous — tests provide little protection
- 60–80%: Acceptable for non-critical code
- 80–90%: Good for most production code
- > 90%: High assurance — critical paths, financial logic, security

## Process

1. **Start with high-value targets** — financial calculations, security checks, business rules.
2. **Run baseline** — get current mutation score before improving tests.
3. **Analyse surviving mutants** — understand WHY each mutant survived.
4. **Write targeted tests** — add assertions that specifically kill the surviving mutants.
5. **Re-run** — verify mutation score improved.
6. **Add to CI** — fail the build if score drops below the threshold.
7. **Iteratively raise the bar** — increase the threshold as the suite improves.
8. **Exclude generated and boilerplate code** — focus on business logic.

## JavaScript / TypeScript — Stryker

```bash
# Install
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner

# Configure
cat > stryker.config.json << 'EOF'
{
  "testRunner": "jest",
  "coverageAnalysis": "perTest",
  "mutator": {
    "excludedMutations": ["StringLiteral"]
  },
  "reporters": ["html", "clear-text", "progress"],
  "thresholds": {
    "high": 90,
    "low":  80,
    "break": 75      // fail CI below 75%
  },
  "timeoutMS": 10000,
  "incremental": true,   // only re-mutate changed files
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.d.ts"
  ]
}
EOF

# Run (full — use in CI)
npx stryker run

# Run on a single file (fast feedback during development)
npx stryker run --mutate src/pricing.ts
```

```
Stryker output example:

  #1. [Survived] ArithmeticOperator
      src/pricing.ts:14:24
      -    const discount = price * rate;
      +    const discount = price / rate;

  #2. [Survived] ConditionalExpression
      src/pricing.ts:8:7
      -    if (quantity >= 10) {
      +    if (false) {

Mutation score: 72.4% (survived: 11, killed: 29, timeout: 0)
```

## Python — mutmut

```bash
# Install
pip install mutmut

# Run on a module
mutmut run --paths-to-mutate src/pricing.py --runner "python -m pytest tests/"

# View surviving mutants
mutmut results

# Show diff for a specific surviving mutant
mutmut show 42

# HTML report
mutmut html
```

```bash
# mutmut output example:
- Mutation id 42 was NOT killed.
--- a/src/pricing.py
+++ b/src/pricing.py
@@ -12,7 +12,7 @@
 def calculate_discount(price: float, quantity: int) -> float:
-    if quantity >= 10:
+    if quantity > 10:
         return price * 0.9
     return price
```

## Java — PIT (Pitest)

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.15.3</version>
    <configuration>
        <targetClasses>
            <param>com.example.pricing.*</param>
            <param>com.example.orders.*</param>
        </targetClasses>
        <targetTests>
            <param>com.example.*Test</param>
        </targetTests>
        <mutationThreshold>80</mutationThreshold>   <!-- fail build below 80% -->
        <coverageThreshold>70</coverageThreshold>
        <outputFormats>
            <outputFormat>HTML</outputFormat>
            <outputFormat>XML</outputFormat>
        </outputFormats>
        <mutators>
            <mutator>STRONGER</mutator>   <!-- broader mutation set than default -->
        </mutators>
        <avoidCallsTo>            <!-- do not mutate logging calls -->
            <avoidCallsTo>java.util.logging</avoidCallsTo>
            <avoidCallsTo>org.slf4j</avoidCallsTo>
        </avoidCallsTo>
    </configuration>
</plugin>
```

```bash
# Run PIT
mvn test-compile org.pitest:pitest-maven:mutationCoverage

# View HTML report at: target/pit-reports/<timestamp>/index.html
```

## Killing Common Surviving Mutants

```python
# Original code
def calculate_discount(price: float, quantity: int) -> float:
    if quantity >= 10:       # boundary condition
        return price * 0.9
    return price

# Weak tests — coverage 100% but mutation score low
def test_discount_basic():
    assert calculate_discount(100, 20) == 90.0  # kills ">=" → "False" but not ">=" → ">"
    assert calculate_discount(100, 5)  == 100.0

# MUTATION SURVIVED: quantity >= 10  →  quantity > 10
# A customer who orders exactly 10 items would NOT get the discount

# Strong tests — write at the boundary
def test_discount_boundary():
    assert calculate_discount(100, 9)  == 100.0  # just below threshold — no discount
    assert calculate_discount(100, 10) == 90.0   # AT threshold — discount applies
    assert calculate_discount(100, 11) == 90.0   # above threshold — discount applies

# Strong tests — assert on return value, not just truthiness
def test_discount_rate():
    result = calculate_discount(200.0, 15)
    assert result == 180.0                        # kills "* 0.9" → "* 0.1" etc.
    assert result == pytest.approx(200.0 * 0.9)

def test_no_discount_returns_original_price():
    price = 150.0
    assert calculate_discount(price, 3) == price  # kills removal of return price
```

## CI Integration

```yaml
# .github/workflows/mutation-test.yml
name: Mutation Tests

on:
  push:
    branches: [main]
  pull_request:
    paths: ['src/**', 'tests/**']

jobs:
  mutation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - run: npm ci
      - run: npm test -- --coverage      # regular tests must pass first

      - name: Run Stryker
        run: npx stryker run
        # Fails if mutation score < thresholds.break (configured in stryker.config.json)

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: reports/mutation/
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Running mutation testing on every file | Too slow; not all code warrants it | Target business logic, financial calculations, security checks |
| Ignoring surviving mutants | They represent real uncaught bugs | Triage each survivor; fix or document why it is acceptable |
| High coverage, low mutation score | False confidence in test quality | Mutation score is the real quality metric |
| Adding assertions to kill mutants without understanding them | Tests that test the wrong thing | Understand the intended behaviour before writing the killing test |
| No CI threshold | Score regresses silently | Set a threshold that fails the build; raise it incrementally |

## Rules

- **Mutation score > coverage as a quality metric** — 100% line coverage with 40% mutation score means your tests are not protecting you.
- **Start with business-critical code** — financial calculations, security checks, and data validation first.
- **Tests must assert on specific values, not just truthiness** — `assert result == 90.0` kills more mutants than `assert result`.
- **Always test boundaries** — the most common surviving mutants are `>=` vs `>` and `<=` vs `<`.
- **Set a CI threshold and never lower it** — once the score is 80%, make 80% the minimum; raise over time.
- **Use incremental mode during development** — only re-mutate changed files for fast feedback.
- **Triage every surviving mutant** — equivalent mutants are acceptable; everything else is a gap in your tests.
- **Exclude generated code, logging, and configuration** — focus mutation effort on hand-written business logic.
- **Mutation testing is slower than unit tests** — run in CI on main branch and PRs; not on every local save.
- **Surviving mutants are a prioritised bug backlog** — they represent real scenarios your tests do not cover.
