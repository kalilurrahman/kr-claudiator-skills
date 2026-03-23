---
name: synthetic-data
description: Generate synthetic datasets for ML training, testing, and privacy-preserving data sharing. Outputs statistical generators, GAN-based synthesis, differential privacy techniques, and validation pipelines.
argument-hint: [data type, privacy requirements, downstream ML task, quality requirements]
allowed-tools: Read, Write, Bash
---

# Synthetic Data Generation

Synthetic data solves three problems: privacy (share data without exposing real users), scarcity (augment small datasets), and testing (generate edge cases on demand). The key challenge is that synthetic data must preserve the statistical properties of real data while not leaking individual records.

## Use Cases and Approaches

| Use Case | Approach | Tools |
|----------|----------|-------|
| Privacy-preserving sharing | Differential privacy + tabular GAN | SDV, Gretel |
| ML augmentation | Statistical synthesis + domain rules | SDV, Faker |
| Test data generation | Rule-based with realistic distributions | Faker, Factory Boy |
| Edge case generation | Adversarial + boundary value synthesis | Custom |
| Time series expansion | AR models, seasonal decomposition | statsmodels |

## Process

1. **Profile real data** — distribution of each column, correlations, nulls, outliers.
2. **Choose synthesis method** — statistical (fast, low privacy) vs. generative model (slower, higher fidelity).
3. **Preserve correlations** — synthetic data that ignores column correlations is useless for ML.
4. **Validate fidelity** — statistical tests comparing synthetic vs. real distributions.
5. **Validate privacy** — membership inference attacks, nearest neighbor distance.
6. **Document provenance** — clearly label synthetic datasets; never mix with real without flagging.

## Output Format

### Statistical Synthesis (SDV)

```python
# synthesis/tabular_synthesizer.py
from sdv.metadata import SingleTableMetadata
from sdv.single_table import CTGANSynthesizer, GaussianCopulaSynthesizer
from sdv.evaluation.single_table import run_diagnostic, evaluate_quality
import pandas as pd
import numpy as np

class TabularSynthesizer:
    def __init__(self, method: str = "ctgan"):
        self.method = method
        self.synthesizer = None
        self.metadata = None
    
    def fit(self, real_data: pd.DataFrame, primary_key: str = None) -> None:
        """Learn the statistical structure of real data."""
        self.metadata = SingleTableMetadata()
        self.metadata.detect_from_dataframe(real_data)
        
        if primary_key:
            self.metadata.update_column(primary_key, sdtype="id")
            self.metadata.set_primary_key(primary_key)
        
        # CTGAN: better for complex distributions; GaussianCopula: faster, better for small data
        if self.method == "ctgan":
            self.synthesizer = CTGANSynthesizer(
                self.metadata,
                epochs=300,
                batch_size=500,
                verbose=True,
            )
        else:
            self.synthesizer = GaussianCopulaSynthesizer(self.metadata)
        
        self.synthesizer.fit(real_data)
    
    def generate(self, n_rows: int) -> pd.DataFrame:
        """Generate n_rows of synthetic data."""
        return self.synthesizer.sample(num_rows=n_rows)
    
    def evaluate(self, real_data: pd.DataFrame, synthetic_data: pd.DataFrame) -> dict:
        """Measure fidelity of synthetic data against real."""
        diagnostic = run_diagnostic(real_data, synthetic_data, self.metadata)
        quality = evaluate_quality(real_data, synthetic_data, self.metadata)
        
        return {
            "overall_quality_score": quality.get_score(),
            "column_shapes": quality.get_details("Column Shapes"),
            "column_pair_trends": quality.get_details("Column Pair Trends"),
            "diagnostic": diagnostic.get_results(),
        }


# Usage
real_orders = pd.read_parquet("s3://ml-data/orders/sample_100k.parquet")

synthesizer = TabularSynthesizer(method="ctgan")
synthesizer.fit(
    real_orders.drop(columns=["customer_email", "customer_phone"]),  # Drop PII before fitting
    primary_key="order_id"
)

synthetic_orders = synthesizer.generate(n_rows=500_000)  # 5x augmentation
scores = synthesizer.evaluate(real_orders, synthetic_orders)

print(f"Quality score: {scores['overall_quality_score']:.3f}")  # 0.85+ is good
print(f"Saving synthetic dataset...")
synthetic_orders.to_parquet("s3://ml-data/synthetic/orders_500k.parquet")
```

### Privacy Validation

```python
# privacy/membership_inference.py
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from dataclasses import dataclass

@dataclass
class PrivacyReport:
    membership_inference_auc: float  # 0.5 = good (random), 1.0 = bad (memorized real data)
    nearest_neighbor_distance: float  # Higher = more privacy
    is_private: bool

class PrivacyEvaluator:
    def evaluate(self, real_data: pd.DataFrame, synthetic_data: pd.DataFrame) -> PrivacyReport:
        
        mia_score = self._membership_inference_attack(real_data, synthetic_data)
        nnd = self._nearest_neighbor_distance(real_data, synthetic_data)
        
        return PrivacyReport(
            membership_inference_auc=mia_score,
            nearest_neighbor_distance=nnd,
            is_private=(mia_score < 0.6 and nnd > 0.3),
        )
    
    def _membership_inference_attack(self, real: pd.DataFrame, synthetic: pd.DataFrame) -> float:
        """
        Train a classifier to distinguish real from synthetic.
        AUC ~0.5: synthetic is indistinguishable from real (good privacy).
        AUC ~1.0: real records can be identified (bad privacy — model memorized real data).
        """
        n = min(len(real), len(synthetic), 10000)
        
        # Numeric columns only for this test
        num_cols = real.select_dtypes(include=[np.number]).columns.tolist()
        
        X = pd.concat([
            real[num_cols].sample(n).assign(_label=1),
            synthetic[num_cols].sample(n).assign(_label=0),
        ])
        
        X = X.fillna(X.median()).replace([np.inf, -np.inf], 0)
        y = X.pop("_label")
        
        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        auc_scores = cross_val_score(clf, X, y, cv=5, scoring="roc_auc")
        
        return float(auc_scores.mean())
    
    def _nearest_neighbor_distance(self, real: pd.DataFrame, synthetic: pd.DataFrame) -> float:
        """
        For each synthetic record, find its closest real record.
        High average distance = synthetic is not just copying real records.
        """
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import pairwise_distances_argmin_min
        
        num_cols = real.select_dtypes(include=[np.number]).columns.tolist()
        n = min(1000, len(real), len(synthetic))
        
        scaler = StandardScaler()
        real_scaled = scaler.fit_transform(real[num_cols].sample(n).fillna(0))
        synth_scaled = scaler.transform(synthetic[num_cols].sample(n).fillna(0))
        
        _, distances = pairwise_distances_argmin_min(synth_scaled, real_scaled)
        return float(distances.mean())
```

### Rule-Based Test Data (Faker)

```python
# generators/test_data_factory.py
from faker import Faker
from factory import Factory, LazyAttribute, LazyFunction, SubFactory
import random
from datetime import datetime, timedelta, timezone

fake = Faker()

class UserFactory(Factory):
    class Meta:
        model = dict
    
    id = LazyFunction(lambda: fake.uuid4())
    email = LazyFunction(lambda: fake.email())
    name = LazyFunction(lambda: fake.name())
    country = LazyFunction(lambda: random.choices(
        ["US", "GB", "DE", "FR", "JP"],
        weights=[40, 15, 10, 8, 7]  # Realistic distribution
    )[0])
    plan = LazyFunction(lambda: random.choices(
        ["starter", "growth", "enterprise"],
        weights=[60, 30, 10]
    )[0])
    created_at = LazyFunction(lambda: fake.date_time_between(
        start_date="-2y", end_date="now", tzinfo=timezone.utc
    ))

class OrderFactory(Factory):
    class Meta:
        model = dict
    
    id = LazyFunction(lambda: fake.uuid4())
    user = SubFactory(UserFactory)
    status = LazyFunction(lambda: random.choices(
        ["pending", "paid", "shipped", "delivered", "refunded"],
        weights=[5, 20, 25, 45, 5]
    )[0])
    total_cents = LazyFunction(lambda: int(
        # Log-normal distribution for realistic order values
        max(500, min(50000, int(random.lognormvariate(7.0, 1.2))))
    ))
    created_at = LazyAttribute(lambda o: o.user["created_at"] + timedelta(
        days=random.randint(0, 365)
    ))

def generate_test_dataset(n_users: int = 100, orders_per_user: int = 5) -> dict:
    users = [UserFactory() for _ in range(n_users)]
    orders = []
    for user in users:
        n_orders = max(0, int(random.gauss(orders_per_user, 2)))
        for _ in range(n_orders):
            order = OrderFactory(user=user)
            orders.append(order)
    
    return {"users": users, "orders": orders}
```

### Differential Privacy

```python
# privacy/differential_privacy.py
import numpy as np

class DifferentiallyPrivateStats:
    """Add calibrated noise to statistics for ε-differential privacy."""
    
    def __init__(self, epsilon: float = 1.0):
        self.epsilon = epsilon  # Smaller = more privacy (but less accuracy)
    
    def private_mean(self, values: np.ndarray, sensitivity: float) -> float:
        """Laplace mechanism for mean."""
        true_mean = np.mean(values)
        noise = np.random.laplace(0, sensitivity / self.epsilon)
        return true_mean + noise
    
    def private_count(self, values: np.ndarray) -> int:
        """Laplace mechanism for count."""
        true_count = len(values)
        noise = np.random.laplace(0, 1.0 / self.epsilon)
        return max(0, int(true_count + noise))
    
    def private_histogram(self, values: np.ndarray, bins: int) -> np.ndarray:
        """Private histogram — all bin counts get noise."""
        true_hist, edges = np.histogram(values, bins=bins)
        noise = np.random.laplace(0, 1.0 / self.epsilon, size=len(true_hist))
        private_hist = np.maximum(0, true_hist + noise).astype(int)
        return private_hist, edges
```

## Rules

- **Never fit synthesis models on PII** — strip identifying columns before fitting; they cannot be regenerated.
- **Validate fidelity before using for ML** — synthetic data with wrong distributions trains models that fail in production.
- **Privacy validation is mandatory** — run membership inference attacks; synthetic ≠ private by default.
- **Document that data is synthetic** — never let synthetic data be confused with real; label clearly in metadata.
- **Preserve correlations** — naive per-column synthesis that ignores correlations is useless for any realistic ML task.
- **Size synthetic datasets appropriately** — 10x real data doesn't always help; validate diminishing returns.
- **Use real data for final evaluation** — train on synthetic, evaluate on real held-out data; never evaluate on synthetic.
- **Version your generators** — changing the generator changes the data; treat generator configs like code.
- **Test edge cases explicitly** — synthetic generation for rare events (fraud, failures) requires oversampling.
- **Differential privacy ε must be chosen with intent** — ε=1.0 is a convention, not a guarantee; understand the math.

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

