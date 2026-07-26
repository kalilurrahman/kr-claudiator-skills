---
name: model-card
description: Write comprehensive model cards documenting ML model capabilities, limitations, biases, and intended use. Outputs structured model card following Google/Hugging Face standards with evaluation results.
argument-hint: [model type, training data, intended use cases, known limitations, deployment context]
allowed-tools: Read, Write
---

# Model Card

A model card is a short document accompanying a trained model that explains what it does, how it was built, its performance across different populations, its limitations, and how it should and should not be used. Model cards enable informed deployment decisions and build accountability into the ML lifecycle.

## Model Card Template

```markdown
---
# Model Card: [Model Name] v[Version]

**Last updated:** YYYY-MM-DD  
**Owner:** [Team Name]  
**Contact:** model-owner@company.com  
**Status:** Production / Deprecated / Experimental  

---

## Model Details

### Model Description
**Architecture:** [e.g. XGBoost, BERT fine-tune, ResNet-50]  
**Task:** [e.g. Binary classification, Named entity recognition, Regression]  
**Version:** 2.1.0  
**Release date:** 2024-03-15  
**Repository:** https://github.com/company/model-repo  
**Artifact:** s3://ml-models/churn-predictor/v2.1.0/  

### Intended Use

**Primary use cases:**
- Predicting 30-day churn probability for B2B SaaS customers
- Prioritising customer success outreach
- Generating automated early-warning alerts

**Out-of-scope uses:**
- Do NOT use for employment decisions, credit scoring, or insurance pricing
- Do NOT use on consumer accounts (trained on B2B data only)
- Do NOT use without human review for accounts >$100k ARR

**Intended users:** Customer success managers, data analysts, automated alert systems

---

## Training Data

### Data Source
- Source: Internal CRM + product analytics warehouse
- Table: `analytics.churn_model_features_v3`
- Training period: 2022-01-01 to 2023-12-31 (24 months)
- Rows: 45,823 accounts
- Positive class (churned): 8,432 (18.4%)

### Features Used (top 10 by importance)
| Feature | Importance | Description |
|---------|-----------|-------------|
| days_since_last_login | 0.187 | Days since any user login |
| active_users_30d | 0.142 | Unique users active in last 30 days |
| support_tickets_open | 0.128 | Open support tickets |
| product_usage_score | 0.115 | Composite feature usage score |
| contract_renewal_days | 0.098 | Days until contract renewal |
| nps_score_latest | 0.087 | Most recent NPS score |
| total_arr | 0.064 | Annual recurring revenue (USD) |
| plan_type | 0.058 | Subscription tier |
| days_since_onboarding | 0.041 | Account age |
| integrations_count | 0.038 | Number of active integrations |

### Data Preprocessing
- Missing values: median imputation for numeric, mode for categorical
- Outlier treatment: winsorisation at 1st/99th percentile
- Class imbalance: SMOTE oversampling to 30% positive rate
- Train/val/test split: 70/15/15 stratified by churn label and industry

### Known Data Limitations
- Underrepresents accounts onboarded < 6 months (insufficient history)
- No data on pricing changes or competitive events
- Self-reported NPS available for only 60% of accounts

---

## Performance

### Overall Metrics (test set, n=6,874)
| Metric | Score | Threshold |
|--------|-------|-----------|
| AUC-ROC | 0.847 | >0.80 |
| Precision (positive class) | 0.73 | >0.65 |
| Recall (positive class) | 0.81 | >0.75 |
| F1 Score | 0.77 | >0.70 |
| Brier Score | 0.112 | <0.15 |

### Calibration
Calibration curve shows slight overconfidence in 0.6-0.8 probability range.
Platt scaling applied post-training (see `calibration.pkl`).

### Performance by Subgroup
| Subgroup | n | AUC | Precision | Recall | Notes |
|----------|---|-----|-----------|--------|-------|
| SMB (<$10k ARR) | 2,841 | 0.831 | 0.71 | 0.79 | Strong performance |
| Mid-market ($10-100k ARR) | 3,201 | 0.862 | 0.76 | 0.83 | Best performance |
| Enterprise (>$100k ARR) | 832 | 0.779 | 0.61 | 0.74 | **Weaker — recommend human review** |
| Technology industry | 1,923 | 0.871 | 0.78 | 0.84 | Best segment |
| Professional services | 1,041 | 0.812 | 0.68 | 0.77 | Average |
| Healthcare | 312 | 0.798 | 0.65 | 0.72 | Smaller sample, lower confidence |
| Accounts <90 days old | 445 | 0.701 | 0.55 | 0.68 | **Significantly weaker — use with caution** |

### Failure Modes
- High false negative rate for accounts with sudden payment issues (no payment data feature)
- Misses churn driven by competitive displacement
- Under-performs on accounts with high login frequency but low feature adoption

---

## Ethical Considerations

### Bias Assessment
The model was evaluated for disparate impact across:
- Company size: No significant disparity found (max AUC gap: 0.083)
- Geography: European accounts show 4% lower recall — attributed to GDPR data gaps
- Industry: Healthcare underperforms due to smaller sample (n=312)

**Mitigation:** Human review required for healthcare accounts and new accounts (<90 days).

### Risk Categorisation
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| False positive → wasted CS resources | Medium | Low | Threshold at 0.65+ only |
| False negative → missed churn | Medium | High | Weekly retraining + email digest |
| Feedback loop → CS attention changes behaviour | Low | Medium | Monitor feature distributions |

### Privacy
- No PII used in features
- Account-level predictions not shared outside CS team
- Predictions stored with 90-day retention

---

## Deployment

### Inference
- **Latency:** <50ms p99 (cached features)
- **Throughput:** Batch: 10,000 accounts/hour | Real-time: single account on-demand
- **Infrastructure:** AWS SageMaker endpoint (ml.t3.medium)

### Prediction Thresholds
| Score Range | Label | Recommended Action |
|-------------|-------|--------------------|
| 0.0 – 0.39 | Low risk | No action |
| 0.40 – 0.64 | Medium risk | Quarterly check-in |
| 0.65 – 0.79 | High risk | CS outreach within 2 weeks |
| 0.80 – 1.0 | Critical risk | CS outreach within 48 hours |

### Monitoring
- Model performance reviewed weekly
- Data drift checked daily (PSI threshold: 0.2)
- Retraining triggered: PSI >0.2 on key features OR AUC drops >0.03 in production

### Retraining Schedule
- Scheduled: Monthly (new 2-month cohort added)
- Triggered: Drift detection, significant performance degradation

---

## Model Lineage

| Version | Date | Changes | AUC |
|---------|------|---------|-----|
| 1.0 | 2023-01-10 | Initial release (logistic regression) | 0.781 |
| 1.5 | 2023-06-15 | Feature expansion, XGBoost | 0.821 |
| 2.0 | 2023-11-01 | SMOTE, calibration, new features | 0.839 |
| 2.1 | 2024-03-15 | Expanded training window, fixed data leak | 0.847 |

---

## How to Use

```python
import mlflow

model = mlflow.pyfunc.load_model("s3://ml-models/churn-predictor/v2.1.0/")

# Single account
prediction = model.predict(account_features_df)
# Returns: {'churn_probability': 0.72, 'risk_tier': 'high', 'model_version': '2.1.0'}

# Batch scoring
batch_results = model.predict(batch_df)
```

## Known Issues and Limitations

1. **New accounts (<90 days):** Performance is significantly lower. Use heuristic rules instead.
2. **Enterprise accounts:** Recall is lower (74%). Always supplement with human judgement for accounts >$100k ARR.
3. **Payment failures:** Not captured in features. Monitor AR separately.
4. **Model staleness:** Performance degrades after ~6 weeks without retraining on new data.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Reporting only aggregate metrics** | Hides poor performance on subgroups | Always report by subgroup; flag weakest segments |
| **No intended use / out-of-scope section** | Model used in contexts it wasn't designed for | Explicit, specific prohibited uses |
| **No version history** | Can't understand how model evolved | Changelog table with metrics per version |
| **No known limitations** | Users trust model in situations it fails | Document every known failure mode explicitly |
| **One-time model card** | Document becomes stale as model is updated | Update model card with every retraining |
| **No contact information** | Who to call when something goes wrong? | Named owner + team + Slack channel |

## 10 Rules

1. Write the model card before deployment — not as an afterthought.
2. Report subgroup performance — aggregate metrics hide bias and underperformance.
3. Document intended use AND out-of-scope uses explicitly and specifically.
4. Include real failure modes, not sanitised ones — honest limitations build trust.
5. Update the model card with every retraining — a stale card is worse than no card.
6. Include calibration results — a model with 80% predicted probability means nothing without calibration.
7. Recommended decision thresholds belong in the model card — analysts shouldn't choose blindly.
8. Document data limitations — what the training data doesn't cover is as important as what it does.
9. Version the model card alongside the model — keep them in the same repository.
10. Model cards are for users, not just model builders — write for the CS manager, not the data scientist.
