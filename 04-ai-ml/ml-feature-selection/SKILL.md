---
name: ml-feature-selection
description: Select the most predictive features for ML models to improve accuracy and reduce overfitting. Outputs filter, wrapper, and embedded selection methods with validation strategy.
argument-hint: [feature count, model type, dataset size, interpretability requirements]
allowed-tools: Read, Write, Bash
---

# ML Feature Selection

Feature selection removes irrelevant and redundant features, reducing overfitting, improving model performance, and cutting inference cost. Too many features hurt generalisation; the right features improve it. The challenge is distinguishing signal from noise without cherry-picking.

## Selection Methods

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.feature_selection import (
    SelectKBest, f_classif, mutual_info_classif,
    RFE, RFECV, SelectFromModel,
    VarianceThreshold,
)
from sklearn.inspection import permutation_importance
import shap

def select_features_pipeline(X: pd.DataFrame, y: pd.Series,
                              n_features: int = 20) -> dict:
    """Run multiple selection methods and compare."""
    results = {}
    
    # 1. FILTER METHODS — fast, model-agnostic
    # Remove low-variance features (near-constant)
    var_filter = VarianceThreshold(threshold=0.01)
    var_filter.fit(X)
    results["variance"] = X.columns[var_filter.get_support()].tolist()
    
    # Mutual information (non-linear relationships)
    mi_scores = mutual_info_classif(X, y, random_state=42)
    mi_ranking = pd.Series(mi_scores, index=X.columns).sort_values(ascending=False)
    results["mutual_info"] = mi_ranking.head(n_features).index.tolist()
    
    # ANOVA F-test (linear relationships with target)
    anova = SelectKBest(f_classif, k=n_features)
    anova.fit(X, y)
    results["anova"] = X.columns[anova.get_support()].tolist()
    
    # 2. WRAPPER METHOD — cross-validated selection
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rfecv = RFECV(estimator=rf, step=1, cv=5, scoring="roc_auc", n_jobs=-1)
    rfecv.fit(X, y)
    results["rfe_cv"] = X.columns[rfecv.support_].tolist()
    print(f"Optimal features (RFECV): {rfecv.n_features_}")
    
    # 3. EMBEDDED METHOD — feature importance from model
    gbm = GradientBoostingClassifier(n_estimators=100, random_state=42)
    gbm.fit(X, y)
    
    # Model feature importance (impurity-based — biased toward high cardinality)
    fi = pd.Series(gbm.feature_importances_, index=X.columns)
    results["gbm_importance"] = fi.nlargest(n_features).index.tolist()
    
    # Permutation importance (less biased)
    perm = permutation_importance(gbm, X, y, n_repeats=10, random_state=42)
    perm_fi = pd.Series(perm.importances_mean, index=X.columns)
    results["permutation"] = perm_fi.nlargest(n_features).index.tolist()
    
    # SHAP values (model-agnostic, interaction-aware)
    explainer = shap.TreeExplainer(gbm)
    shap_values = explainer.shap_values(X.sample(min(1000, len(X))))
    shap_importance = pd.Series(
        np.abs(shap_values).mean(0), index=X.columns
    )
    results["shap"] = shap_importance.nlargest(n_features).index.tolist()
    
    return results

def ensemble_ranking(results: dict, n_top: int = 20) -> list[str]:
    """Rank features by how many methods selected them."""
    from collections import Counter
    all_features = []
    for features in results.values():
        all_features.extend(features)
    
    counts = Counter(all_features)
    # Features selected by most methods first
    return [f for f, _ in counts.most_common(n_top)]
```

## Correlation-Based Redundancy Removal

```python
def remove_correlated_features(X: pd.DataFrame,
                                threshold: float = 0.95) -> pd.DataFrame:
    """Remove one of each highly correlated feature pair."""
    corr_matrix = X.corr().abs()
    upper_tri = corr_matrix.where(
        np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
    )
    
    # Find columns with correlation above threshold
    to_drop = [col for col in upper_tri.columns
               if any(upper_tri[col] > threshold)]
    
    print(f"Removing {len(to_drop)} correlated features: {to_drop[:5]}...")
    return X.drop(columns=to_drop)
```

## Validation Strategy

```python
from sklearn.model_selection import cross_val_score

def validate_feature_selection(X: pd.DataFrame, y: pd.Series,
                                 selected_features: list[str],
                                 model) -> dict:
    """Compare model performance with and without feature selection."""
    X_all = X
    X_selected = X[selected_features]
    
    cv_all = cross_val_score(model, X_all, y, cv=5, scoring="roc_auc")
    cv_selected = cross_val_score(model, X_selected, y, cv=5, scoring="roc_auc")
    
    return {
        "all_features":      {"n": X_all.shape[1],       "auc": cv_all.mean(),      "std": cv_all.std()},
        "selected_features": {"n": X_selected.shape[1],  "auc": cv_selected.mean(), "std": cv_selected.std()},
        "reduction":         f"{1 - len(selected_features)/X.shape[1]:.0%}",
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Single selection method** | Method-specific bias | Ensemble multiple methods |
| **Selecting on full dataset** | Data leakage inflates performance | Select within cross-validation folds |
| **Ignoring correlation** | Redundant features waste model capacity | Remove correlated pairs after importance ranking |
| **Keeping all high-importance features** | May overfit | Validate selection with held-out test set |
| **Never revisiting features** | Data distribution changes; new features available | Quarterly feature set review |

## 10 Rules

1. Run multiple selection methods and take the consensus — no single method is best.
2. Feature selection must happen inside cross-validation folds — no leakage.
3. Remove near-zero-variance features first — they're almost certainly noise.
4. Correlation pruning after importance ranking — importance ignores redundancy.
5. SHAP values are the most reliable importance measure — they account for interactions.
6. Permutation importance > impurity importance for high-cardinality features.
7. Validate that selected features improve generalisation — not just in-sample.
8. Domain knowledge overrides statistical methods — keep features you know matter even if they rank low.
9. More features ≠ better model — fewer good features consistently outperform many mediocre ones.
10. Document the selected feature set and reasons — future team members need to understand the choices.
