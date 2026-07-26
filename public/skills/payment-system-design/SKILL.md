---
name: payment-system-design
description: Design payment processing systems with strong consistency, idempotency, and fraud prevention. Outputs payment flow architecture, idempotency design, reconciliation process, and compliance requirements.
argument-hint: [payment methods, volume, compliance requirements, geography, fraud risk]
allowed-tools: Read, Write
---

# Payment System Design

Payment systems are among the most unforgiving in software engineering. A bug can mean double charges, failed payments, or financial fraud. Every payment flow must be idempotent, atomic, and auditable. The design must assume failures at every step.

## Core Requirements

```
CORRECTNESS: Money must never be created or destroyed incorrectly.
IDEMPOTENCY: Retrying a payment must never double-charge.
ATOMICITY: Payment succeeds or fails completely — no partial states.
AUDITABILITY: Every state change is recorded with timestamp and actor.
CONSISTENCY: The amount in the ledger always equals the sum of transactions.
RECONCILIATION: Daily reconciliation with payment processors detects discrepancies.
```

## Payment Flow Architecture

```python
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
import uuid

class PaymentStatus(Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    REFUNDED = "refunded"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Payment:
    payment_id: str
    order_id: str
    customer_id: str
    amount: Decimal
    currency: str
    status: PaymentStatus
    idempotency_key: str
    processor_transaction_id: str | None = None
    created_at: datetime = None
    updated_at: datetime = None

class PaymentService:
    """Core payment service with idempotency and audit trail."""
    
    async def initiate_payment(
        self,
        order_id: str,
        amount: Decimal,
        currency: str,
        payment_method_token: str,
        idempotency_key: str,
    ) -> Payment:
        # Idempotency check — return existing payment if key already used
        existing = await self.payment_repo.find_by_idempotency_key(idempotency_key)
        if existing:
            return existing  # Safe to return same result
        
        # Create payment record BEFORE calling processor
        # This ensures we have a record even if processor call succeeds but response is lost
        payment = Payment(
            payment_id=str(uuid.uuid4()),
            order_id=order_id,
            customer_id=await self.order_repo.get_customer(order_id),
            amount=amount,
            currency=currency,
            status=PaymentStatus.PENDING,
            idempotency_key=idempotency_key,
            created_at=datetime.utcnow(),
        )
        await self.payment_repo.save(payment)
        await self.audit_log.record("payment.initiated", payment)
        
        try:
            # Call payment processor
            result = await self.stripe.create_payment_intent(
                amount=int(amount * 100),   # Stripe uses cents
                currency=currency,
                payment_method=payment_method_token,
                idempotency_key=idempotency_key,  # Stripe also deduplicates
                confirm=True,
            )
            
            payment.status = PaymentStatus.CAPTURED
            payment.processor_transaction_id = result.id
            payment.updated_at = datetime.utcnow()
            
        except StripeCardError as e:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = str(e)
            payment.updated_at = datetime.utcnow()
        except Exception as e:
            # Network error — status unknown; do NOT mark as failed
            # The payment may have succeeded at Stripe; reconciliation will clarify
            payment.status = PaymentStatus.PENDING
            await self.alert_team(f"Payment {payment.payment_id} in unknown state: {e}")
        
        await self.payment_repo.save(payment)
        await self.audit_log.record(f"payment.{payment.status.value}", payment)
        return payment
```

## Ledger Design

```sql
-- Double-entry ledger — every transaction has equal debit and credit
CREATE TABLE ledger_entries (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(payment_id),
    account_id      VARCHAR(100) NOT NULL,  -- customer:uuid | merchant:uuid | fees:stripe
    entry_type      VARCHAR(10) NOT NULL,   -- debit | credit
    amount_cents    BIGINT NOT NULL,        -- Always positive
    currency        CHAR(3) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT positive_amount CHECK (amount_cents > 0)
);

-- Example: $50 payment
-- Debit customer:cust-123 $50 (money out of customer)
-- Credit merchant:merch-456 $48.50 (money to merchant)
-- Credit fees:stripe $1.50 (Stripe fee)
-- Sum must = 0: -5000 + 4850 + 150 = 0

-- Daily reconciliation query
SELECT 
    DATE(created_at) AS date,
    currency,
    SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE -amount_cents END) AS balance
FROM ledger_entries
GROUP BY 1, 2
HAVING ABS(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE -amount_cents END)) > 0;
-- Should return 0 rows if balanced
```

## Reconciliation

```python
async def daily_reconciliation(date: str):
    """Compare internal records with Stripe payout report."""
    # 1. Get internal captured payments
    internal = await payment_repo.get_captured_payments(date)
    
    # 2. Get Stripe balance transactions
    stripe_txns = await stripe.balance_transactions.list(
        created={"gte": parse_date(date), "lt": parse_date(next_day(date))},
        limit=100,
    )
    
    # 3. Match by processor_transaction_id
    internal_ids = {p.processor_transaction_id: p for p in internal}
    stripe_ids = {t.id: t for t in stripe_txns}
    
    # 4. Find discrepancies
    missing_in_stripe = set(internal_ids) - set(stripe_ids)
    missing_in_internal = set(stripe_ids) - set(internal_ids)
    amount_mismatches = [
        (id, internal_ids[id].amount, Decimal(stripe_ids[id].amount) / 100)
        for id in internal_ids & stripe_ids
        if internal_ids[id].amount != Decimal(stripe_ids[id].amount) / 100
    ]
    
    if missing_in_stripe or missing_in_internal or amount_mismatches:
        await alert_finance_team({
            "missing_in_stripe": list(missing_in_stripe),
            "missing_in_internal": list(missing_in_internal),
            "amount_mismatches": amount_mismatches,
        })
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No idempotency** | Retry causes double charge | Idempotency key on every payment attempt |
| **Calling processor without local record** | Processor succeeds; record lost on crash | Write local record BEFORE calling processor |
| **Marking unknown state as failed** | Network error ≠ payment failed | Keep as PENDING; resolve via reconciliation |
| **Floating point for amounts** | `0.1 + 0.2 != 0.3` | Always integer cents; Decimal for computation |
| **No reconciliation** | Discrepancies accumulate undetected | Daily automated reconciliation with processor |

## 10 Rules

1. Idempotency keys are mandatory — every payment attempt has a client-generated key.
2. Create local payment record before calling the processor — you need the record even if the response is lost.
3. Network errors are UNKNOWN, not FAILED — reconciliation resolves unknown states.
4. Amounts are always integer cents — never floats.
5. Double-entry ledger — every transaction has equal and opposite entries; sum is always zero.
6. Daily reconciliation with the payment processor is non-negotiable.
7. Payment status transitions are logged immutably — every state change is an audit record.
8. Refunds are separate transactions — never modify original payment records.
9. PCI DSS compliance requires: no raw card data stored, encrypted transmission, access controls.
10. Design for the failure case — what happens when Stripe returns 200 but your server crashes before saving?
