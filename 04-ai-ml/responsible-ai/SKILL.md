---
name: responsible-ai
description: Implement responsible AI practices covering fairness, transparency, accountability, and safety in production AI systems. Outputs fairness assessment, model documentation, governance process, and monitoring plan.
argument-hint: [model type, affected populations, regulatory environment, risk level]
allowed-tools: Read, Write
---

# Responsible AI

Responsible AI is the practice of designing, building, and deploying AI systems that are fair, transparent, accountable, and safe. It is not just ethics documentation — it is operational practice embedded into the ML lifecycle.

## Responsible AI Framework

```
FAIRNESS
  Model does not produce systematically biased outcomes
  for protected groups (race, gender, age, disability)

TRANSPARENCY
  Decision processes are understandable to affected people
  Model behaviour is explainable and documented

ACCOUNTABILITY
  Clear ownership of model outcomes
  Audit trail for high-stakes decisions
  Redress mechanism for affected individuals

SAFETY
  Model does not produce harmful outputs
  Human oversight for high-stakes decisions
  Monitoring and incident response in place

PRIVACY
  Training data minimises PII exposure
  Inference does not leak training data
  Right to erasure respected
```

## Fairness Assessment

```python
import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix

def assess_fairness(
    predictions: pd.DataFrame,  # columns: y_true, y_pred, protected_attribute
    attribute: str,
    positive_label: int = 1,
) -> dict:
    """
    Assess model fairness across demographic groups.
    Computes: demographic parity, equalised odds, predictive parity.
    """
    results = {}
    groups = predictions[attribute].unique()
    
    for group in groups:
        subset = predictions[predictions[attribute] == group]
        tn, fp, fn, tp = confusion_matrix(
            subset["y_true"], subset["y_pred"], labels=[0, positive_label]
        ).ravel()
        
        total = len(subset)
        results[group] = {
            "n": total,
            "positive_rate": (tp + fp) / total,          # Demographic parity
            "tpr": tp / (tp + fn) if (tp + fn) > 0 else 0,  # True positive rate
            "fpr": fp / (fp + tn) if (fp + tn) > 0 else 0,  # False positive rate
            "precision": tp / (tp + fp) if (tp + fp) > 0 else 0,  # Predictive parity
        }
    
    # Compute disparities
    rates = {metric: [results[g][metric] for g in groups]
             for metric in ["positive_rate", "tpr", "fpr", "precision"]}
    
    disparities = {metric: max(vals) - min(vals)
                   for metric, vals in rates.items()}
    
    # Flag violations (>10% disparity is a common threshold)
    THRESHOLD = 0.10
    violations = {m: d for m, d in disparities.items() if d > THRESHOLD}
    
    return {
        "by_group": results,
        "disparities": disparities,
        "violations": violations,
        "fairness_status": "FAIL" if violations else "PASS",
    }

# Run before every model deployment
fairness_report = assess_fairness(
    test_predictions,
    attribute="gender",
)
if fairness_report["fairness_status"] == "FAIL":
    print("Fairness violations found:", fairness_report["violations"])
    # Do NOT deploy until violations are investigated
```

## Explainability

```python
import shap
import lime

def explain_prediction(model, instance: pd.DataFrame,
                        feature_names: list) -> dict:
    """Generate human-readable explanation for a single prediction."""
    
    # SHAP values — feature attribution
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(instance)
    
    # Top contributing features
    feature_importance = sorted(
        zip(feature_names, shap_values[0]),
        key=lambda x: abs(x[1]),
        reverse=True,
    )
    
    explanation = {
        "prediction": float(model.predict_proba(instance)[0][1]),
        "top_factors": [
            {
                "feature": name,
                "value": float(instance[name].iloc[0]),
                "impact": float(impact),
                "direction": "increases" if impact > 0 else "decreases",
            }
            for name, impact in feature_importance[:5]
        ],
        "explanation_text": generate_natural_language_explanation(feature_importance[:3]),
    }
    return explanation

def generate_natural_language_explanation(top_features: list) -> str:
    """Convert SHAP values to plain language."""
    parts = []
    for name, impact in top_features:
        direction = "positively" if impact > 0 else "negatively"
        parts.append(f"{name} {direction} influenced this prediction")
    return "; ".join(parts)
```

## AI Governance Process

```markdown
## AI System Registration

Every AI system in production must be registered in the AI inventory:

**System:** Loan Approval Model v2.1  
**Owner:** Credit Risk Team  
**Risk level:** HIGH (financial decisions affecting customers)  
**Data used:** Credit bureau data, income verification, application history  
**Decision type:** Automated with human review for denials  
**Affected population:** Retail loan applicants  
**Last fairness assessment:** 2024-03-01  
**Next review:** 2024-09-01  

## High-Risk AI Decision Checklist

Before deploying any AI system making high-stakes decisions (hiring, credit, healthcare, criminal justice):

- [ ] Fairness assessment across all relevant protected attributes
- [ ] Explainability mechanism for affected individuals
- [ ] Human review process for adverse decisions
- [ ] Redress/appeal mechanism documented and operational
- [ ] Model card completed and approved by ethics review board
- [ ] Legal review (GDPR Article 22 / CCPA / relevant regulation)
- [ ] Monitoring plan with fairness metrics tracked in production
- [ ] Incident response plan for model failures
```

## Production Monitoring

```python
# Track fairness metrics in production continuously
class FairnessMonitor:
    def __init__(self, protected_attributes: list, threshold: float = 0.10):
        self.attributes = protected_attributes
        self.threshold = threshold
    
    async def daily_fairness_check(self, model_id: str, date: str):
        predictions = await get_production_predictions(model_id, date)
        
        alerts = []
        for attribute in self.attributes:
            if attribute not in predictions.columns:
                continue
            
            report = assess_fairness(predictions, attribute)
            
            for metric, disparity in report["disparities"].items():
                if disparity > self.threshold:
                    alerts.append({
                        "model": model_id,
                        "date": date,
                        "attribute": attribute,
                        "metric": metric,
                        "disparity": disparity,
                        "threshold": self.threshold,
                    })
        
        if alerts:
            await notify_ml_team(f"Fairness alert for {model_id}", alerts)
        
        return alerts
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Fairness as one-time audit** | Drift occurs; new data introduces bias | Continuous fairness monitoring in production |
| **Optimising only for accuracy** | Accurate but unfair model deployed | Include fairness metrics in model selection criteria |
| **No explainability for adverse decisions** | Regulatory risk; customer harm | Explanations required for loan/employment/healthcare decisions |
| **No human override** | Automated system makes irreversible harmful decisions | Human review required for high-stakes adverse outcomes |
| **Ethics docs without operations** | Documentation compliance, not genuine practice | Fairness checks in CI/CD pipeline |

## 10 Rules

1. Fairness assessment is a deployment gate — not a post-deployment review.
2. Assess fairness across all legally protected attributes (race, gender, age, disability).
3. Demographic parity is one fairness metric — also check equalised odds and predictive parity.
4. High-stakes AI decisions (credit, employment, healthcare) require human oversight and appeal rights.
5. Explainability is for users, not just developers — plain language explanations for adverse decisions.
6. Monitor fairness metrics in production continuously — data drift can introduce bias after deployment.
7. AI system inventory is mandatory — you cannot govern what you have not catalogued.
8. Model cards are required for every production model — capabilities, limitations, and known biases.
9. Privacy by design — minimum PII in training data; right to erasure mechanisms.
10. Responsible AI is cross-functional — legal, ethics, product, and engineering all own it.
