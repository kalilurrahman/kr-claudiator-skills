---
name: data-anonymization
description: Implement data anonymization and pseudonymization techniques for GDPR compliance, safe analytics, and test data generation. Outputs anonymization pipelines, k-anonymity validation, differential privacy, and de-identification strategies.
argument-hint: [data types, compliance requirements, analytics needs, re-identification risk tolerance]
allowed-tools: Read, Write, Bash
---

# Data Anonymization

Anonymization removes personal identifiers so that individuals cannot be re-identified. Pseudonymization replaces identifiers with reversible tokens. True anonymization is irreversible — once done, GDPR no longer applies to that data.

## Techniques

| Technique | Reversible | GDPR Applies | Use Case |
|-----------|-----------|-------------|---------|
| Pseudonymization | Yes (with key) | Yes | Data sharing where re-linking may be needed |
| Generalization | No | No | Analytics (age group vs. exact age) |
| Suppression | No | No | Remove outliers or rare categories |
| Data masking | No | No | Test data generation |
| K-anonymity | No | No | Dataset release (each record looks like k others) |
| Differential privacy | No | No | Aggregate statistics with math guarantees |

## Output Format

### Pseudonymization Pipeline

```python
# anonymization/pseudonymizer.py
import hashlib
import hmac
import secrets
import os
from functools import lru_cache

class Pseudonymizer:
    """
    Reversible pseudonymization using HMAC.
    Same input + same key = same output (deterministic).
    Needed for joining pseudonymized datasets.
    """
    
    def __init__(self, secret_key: bytes = None):
        self.key = secret_key or os.environ.get("PSEUDONYMIZATION_KEY", "").encode()
        if not self.key:
            raise ValueError("PSEUDONYMIZATION_KEY environment variable required")
    
    def pseudonymize(self, value: str, domain: str = "default") -> str:
        """
        Deterministically hash a value with domain separation.
        Different domains produce different outputs for the same input.
        """
        msg = f"{domain}:{value}".encode()
        return hmac.new(self.key, msg, hashlib.sha256).hexdigest()[:16]
    
    def pseudonymize_email(self, email: str) -> str:
        """Replace email while preserving domain for analytics."""
        local, domain = email.split('@', 1)
        pseudonym = self.pseudonymize(email, "email")
        return f"{pseudonym}@{domain}"
    
    def pseudonymize_ip(self, ip: str) -> str:
        """Mask last octet of IPv4, last 80 bits of IPv6."""
        if ':' in ip:   # IPv6
            parts = ip.split(':')
            return ':'.join(parts[:4]) + ':0000:0000:0000:0000'
        else:           # IPv4
            parts = ip.split('.')
            return '.'.join(parts[:3]) + '.0'
    
    def pseudonymize_dataframe(self, df, columns: dict) -> 'pd.DataFrame':
        """
        Pseudonymize multiple columns in a DataFrame.
        columns: {column_name: "type"} where type is "id", "email", "ip", "name", "phone"
        """
        import pandas as pd
        result = df.copy()
        
        for col, col_type in columns.items():
            if col not in result.columns:
                continue
            
            if col_type == "id":
                result[col] = result[col].astype(str).apply(
                    lambda x: self.pseudonymize(x, "id")
                )
            elif col_type == "email":
                result[col] = result[col].apply(self.pseudonymize_email)
            elif col_type == "ip":
                result[col] = result[col].apply(self.pseudonymize_ip)
            elif col_type == "name":
                result[col] = result[col].apply(
                    lambda x: self.pseudonymize(str(x), "name")[:8].title()
                )
            elif col_type == "phone":
                result[col] = result[col].apply(
                    lambda x: "555-" + self.pseudonymize(str(x), "phone")[:7]
                )
            elif col_type == "drop":
                result = result.drop(columns=[col])
        
        return result
```

### Data Masking for Test Data

```python
# anonymization/masker.py
from faker import Faker
import pandas as pd
import random

fake = Faker()
Faker.seed(42)   # Deterministic for reproducible test data

class DataMasker:
    """Replace real PII with realistic fake data for development/testing."""
    
    MASKING_RULES = {
        "name":         lambda _: fake.name(),
        "first_name":   lambda _: fake.first_name(),
        "last_name":    lambda _: fake.last_name(),
        "email":        lambda _: fake.email(),
        "phone":        lambda _: fake.phone_number(),
        "address":      lambda _: fake.address().replace('\n', ', '),
        "city":         lambda _: fake.city(),
        "country":      lambda _: fake.country_code(),  # Keep country for analytics
        "zip_code":     lambda _: fake.zipcode(),
        "ssn":          lambda _: fake.ssn(),
        "credit_card":  lambda _: fake.credit_card_number(),
        "dob":          lambda dob: fake.date_of_birth(
                            minimum_age=18, maximum_age=90
                        ).strftime("%Y-%m-%d"),
        "ip_address":   lambda _: fake.ipv4(),
        "user_agent":   lambda _: fake.user_agent(),
        "notes":        lambda _: fake.sentence(),
    }
    
    def mask_dataframe(self, df: pd.DataFrame, column_types: dict) -> pd.DataFrame:
        result = df.copy()
        
        for col, col_type in column_types.items():
            if col not in result.columns:
                continue
            
            if col_type in self.MASKING_RULES:
                rule = self.MASKING_RULES[col_type]
                result[col] = result[col].apply(rule)
            elif col_type == "partial_mask":
                # Show first/last chars only: john.doe@... → j*****@gmail.com
                result[col] = result[col].apply(self._partial_mask_email)
            elif col_type == "generalize_age":
                result[col] = result[col].apply(
                    lambda age: f"{(age // 10) * 10}s"  # 37 → "30s"
                )
            elif col_type == "suppress":
                result = result.drop(columns=[col])
        
        return result
    
    def _partial_mask_email(self, email: str) -> str:
        if not isinstance(email, str) or '@' not in email:
            return "****@****.***"
        local, domain = email.split('@', 1)
        masked_local = local[0] + '*' * (len(local) - 1)
        return f"{masked_local}@{domain}"
    
    def create_test_dataset(
        self,
        real_df: pd.DataFrame,
        schema: dict,
        output_path: str = None
    ) -> pd.DataFrame:
        """
        Create a masked test dataset from production data.
        Preserves statistical distributions and row counts.
        """
        masked = self.mask_dataframe(real_df, schema)
        
        if output_path:
            masked.to_parquet(output_path, index=False)
            print(f"Test dataset saved: {len(masked):,} rows → {output_path}")
        
        return masked
```

### K-Anonymity Validation

```python
# anonymization/k_anonymity.py
import pandas as pd

def check_k_anonymity(
    df: pd.DataFrame,
    quasi_identifiers: list[str],
    k: int = 5
) -> dict:
    """
    Verify k-anonymity: every combination of quasi-identifiers
    appears at least k times in the dataset.
    k=5 means each record is indistinguishable from at least 4 others.
    """
    groups = df.groupby(quasi_identifiers).size().reset_index(name='count')
    
    violations = groups[groups['count'] < k]
    
    return {
        "k": k,
        "total_groups": len(groups),
        "violating_groups": len(violations),
        "min_group_size": groups['count'].min(),
        "is_k_anonymous": len(violations) == 0,
        "sample_violations": violations.head(5).to_dict('records'),
    }

def generalize_to_achieve_k_anonymity(
    df: pd.DataFrame,
    quasi_identifiers: list[str],
    k: int = 5
) -> pd.DataFrame:
    """Suppress records in groups smaller than k."""
    groups = df.groupby(quasi_identifiers).size().reset_index(name='_count')
    df_with_count = df.merge(groups, on=quasi_identifiers)
    
    # Suppress rows in groups below k
    result = df_with_count[df_with_count['_count'] >= k].drop(columns=['_count'])
    
    suppressed = len(df) - len(result)
    if suppressed > 0:
        print(f"Suppressed {suppressed:,} records ({100*suppressed/len(df):.1f}%) to achieve {k}-anonymity")
    
    return result

# Example
df = pd.read_parquet("users.parquet")

# Check if dataset is k-anonymous with age_group, country, gender as quasi-identifiers
result = check_k_anonymity(
    df,
    quasi_identifiers=["age_group", "country", "gender"],
    k=5
)

print(f"K-anonymous: {result['is_k_anonymous']}")
print(f"Min group size: {result['min_group_size']}")
if not result['is_k_anonymous']:
    print(f"Violations: {result['violating_groups']}")
```

### Production Data Pipeline

```python
# pipelines/anonymize_for_analytics.py
"""
Nightly job: anonymize production data for analytics use.
Output: anonymized dataset safe for BI tools and data scientists.
"""

import pandas as pd
from anonymization.pseudonymizer import Pseudonymizer
from anonymization.masker import DataMasker

pseudonymizer = Pseudonymizer()
masker = DataMasker()

def anonymize_orders_for_analytics():
    # Load raw data
    df = pd.read_parquet("s3://prod-data/orders/today/")
    
    print(f"Anonymizing {len(df):,} orders...")
    
    # Step 1: Pseudonymize joinable IDs (keep analytics cross-dataset linking)
    df['user_id'] = df['user_id'].apply(
        lambda x: pseudonymizer.pseudonymize(str(x), "user_id")
    )
    
    # Step 2: Generalize quasi-identifiers
    df['age_group'] = pd.cut(
        df['age'],
        bins=[0, 18, 25, 35, 45, 55, 65, 120],
        labels=['<18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']
    )
    
    # Step 3: Drop direct identifiers
    columns_to_drop = [
        'shipping_name', 'shipping_address', 'billing_name',
        'email', 'phone', 'age',   # Replaced by age_group
        'ip_address',              # Drop entirely
    ]
    df = df.drop(columns=[c for c in columns_to_drop if c in df.columns])
    
    # Step 4: Keep business-relevant fields unchanged
    # order_id, product_id, amount_cents, status, country, created_at — safe to keep
    
    # Step 5: Validate k-anonymity
    qi = ['age_group', 'country', 'product_category']
    result = check_k_anonymity(df, qi, k=5)
    if not result['is_k_anonymous']:
        df = generalize_to_achieve_k_anonymity(df, qi, k=5)
    
    # Write to analytics store
    df.to_parquet("s3://analytics-data/orders/today/", index=False)
    print(f"✅ Anonymized dataset written: {len(df):,} rows")
    
    return {"rows": len(df), "k_anonymous": result['is_k_anonymous']}
```

## Rules

- **Anonymization is context-dependent** — a dataset anonymous alone may be re-identifiable when joined with others.
- **Test re-identification risk** — don't assume anonymization works; attempt to re-identify with auxiliary data.
- **k-anonymity minimum k=5** — below 5, records are too easily singled out; aim for k=10+ for sensitive data.
- **Pseudonymization ≠ anonymization** — if you keep the key, GDPR still applies.
- **Never anonymize in place on production** — anonymize to a separate dataset; never modify the source.
- **Validate statistically** — after anonymization, verify distributions are preserved (utility) and re-identification is hard (privacy).
- **Generalize, don't mask at random** — fake data should be plausible and statistically similar to real data.
- **Separate keys from data** — pseudonymization keys must be stored separately from the pseudonymized dataset.
- **Document what was done** — anonymization transformations must be documented for audit and reproducibility.
- **Re-evaluate when schema changes** — new columns may introduce re-identification risk; audit anonymization on every schema change.


## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

