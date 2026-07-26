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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Ml Feature Selection** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Select the most predictive features for ML models to improve accuracy and reduce overfitting. Outputs filter, wrapper, and embedded selection methods with valid
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
