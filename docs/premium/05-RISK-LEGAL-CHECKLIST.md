# 05 · Risk, Legal & Compliance Checklist

Twenty gaps a top-tier consultant would flag, each with its fix. Items 1–7 are pre-launch
blockers; the rest must be closed before or shortly after the founding launch.

> Not legal advice. Engage a lawyer (IP/consumer) and a chartered accountant before launch.

## Blockers

**1. The repo has NO license file — and MIT would be the wrong fix.**
The site says "open-source," but the repo is unlicensed (all-rights-reserved by default). MIT
would let anyone republish and *resell* the free 120 skills, including the flagship proof
pieces, with no recourse.
**Fix:** deliberately choose the free tier's license in Phase 0 — CC BY-NC-SA 4.0 (share-alike,
non-commercial, attribution) is the natural fit if resale must be blocked; accept that it is
not OSI "open source" and adjust site copy, or accept resale and use MIT. Premium content is
never in the licensed repo and carries a proprietary EULA.

**2. Git history makes any "leak purge" incomplete.**
Stripping `/public/data` at HEAD leaves every skill in commit history, forks, Wayback, and LLM
training sets forever.
**Fix:** treat all pre-launch content as permanently public. Build paid volumes in a private
repo from day one; sell only substantively new/rebuilt material.

**3. No buyer EULA exists.** "3-device license" is an activation limit, not a license.
**Fix:** one-page EULA at checkout: personal per-seat use; commercial *use of outputs* allowed;
no redistribution, resale, or LLM-corpus ingestion of the content itself; team tiers per-seat;
PPP licenses non-transferable. Surface it at checkout and in every delivered LICENSE.txt.

**4. Anthropic trademark risk is existential to the brand.**
"Claudiator," "Claudiator Press," and paid products built around the Claude name sit close to
Anthropic's brand-guideline prohibition on product names implying affiliation. A C&D at month 6
destroys all SEO equity. The "Claude 5 Mythos & Fable" category with invented model frontmatter
compounds the risk.
**Fix:** review Anthropic's trademark/usage policy *now*; prefer nominative use ("[Brand] —
field manuals *for* Claude Code"); pre-register a fallback brand + domain before spending on
launch; remove fabricated model IDs in Phase 0 triage.

**5. Copyrightability of AI-generated content weakens your own enforcement.**
Purely AI-generated text has no US copyright protection — which undermines the DMCA leg of
social DRM and invites the "AI slop at $249" attack.
**Fix:** document substantial human authorship/editing per volume (the rubric process IS the
evidence); be openly transparent about the human-edited, CI-tested workflow in marketing.

**6. Polar's India-payout support is asserted, not verified.**
The platform choice collapses if an India-resident seller can't get paid.
**Fix:** verify seller-country eligibility, complete identity verification, and run a test
payout in Phase 0. Pre-commit a Gumroad fallback decision date. (Note: Gumroad PayPal payout is
unavailable for India-based sellers — use direct bank transfer; unverified accounts face a $100
payout minimum.)

**7. Seller-side tax and entity structure are missing.**
MoR covers *buyer* VAT/GST only. India GST/LUT for export of services, FEMA remittance
treatment, advance tax, and a legal entity for the Teams tier (W-8BEN-E, vendor onboarding
forms) are all open.
**Fix:** engage a CA pre-launch; form a proprietorship/LLP before the Teams tier ships.

## High priority

**8. Refund policy vs EU law and instant delivery.** 30-day guarantee on instantly-downloaded
content needs the EU 14-day digital-content withdrawal waiver checkbox at checkout, a stated
refund-after-download stance, and clarity that revoked keys don't claw back PDFs.
**Fix:** waiver checkbox + published refund policy + refund-rate alarm (>5% = investigate).

**9. GDPR/privacy.** Email capture, buyer emails in Supabase, and emails stamped into
watermarks are personal-data processing.
**Fix:** privacy policy + double opt-in list capture + DPAs with Polar/Supabase before Phase 1
email capture goes live; document watermarking in the privacy policy.

**10. No liability disclaimer for advice-shaped content.** Threat-modeling, secrets-management,
and executive playbooks invite "your skill missed X" claims.
**Fix:** ToS with warranty disclaimer, liability cap, and "not professional advice" language.

**11. "Lifetime updates" is legally and operationally unbounded.** In the EU, promised updates
are enforceable; solo-author bus-factor is real.
**Fix:** define contractually — "updates to this edition for a minimum of 24 months" + sunset
clause (final DRM-free editions if updates cease). A liability becomes a trust signal.

**12. Single-founder capacity math.** Rebuilding ~70 skills to book quality with CI-tested code
in 6 weeks + infra + launch + a volume every 6–8 weeks + free-tier maintenance + support is
2–3 FTE of work.
**Fix:** budget explicit weekly hours per workstream; cut launch scope to ONE volume if the
rubric slips (Vol. I alone is a viable launch); contract a technical editor before Vol. II.

**13. No support operations plan.** License troubleshooting, magic-link failures, seat admin,
refunds have no owner/inbox/FAQ/SLA.
**Fix:** support address + license FAQ + self-serve device deactivation + ~5 hrs/week reserved.

## Structural risks

**14. Platform risk on Anthropic itself.** The business is 100% downstream of Claude Code and
the Skills spec; an official skills marketplace or spec change could obsolete the catalog.
**Fix:** keep content ~70% durable engineering practice / 30% Claude-specific; frame volumes as
"agent skills" portable to other harnesses.

**15. SEO/AI-answer cannibalization.** 120 full-content free pages target the same queries as
paid volumes; llms.txt means AI answers satisfy some queries with zero clicks.
**Fix:** differentiate paid by *artifact type* (capstones, evals, typeset editions, templates),
volume-specific CTA on every free page, measure citation→visit→email conversion as a KPI.

**16. No validation gate before the big build.** The $120–300k year-one frame rests on zero
measured traffic/conversion baseline.
**Fix:** Phase 1 gate — ≥1,000 email subs or ≥100 tripwire/pre-order sales — must pass before
Vol. II is completed; pivot plan if it fails (see 06-ROADMAP).

**17. Contributor program creates an IP intake problem.** "Accepted PR = free Complete Library"
brings outside IP into a commercialized corpus with no assignment.
**Fix:** lightweight CLA/DCO granting relicensing rights as a condition of PR acceptance.

**18. Affiliate program has no compliance layer.** Ten YouTubers at 30% with no disclosure
requirements risks FTC endorsement-rule violations attributed to you.
**Fix:** one-page affiliate agreement mandating #ad/material-connection disclosure, cookie/
attribution terms, payout terms.

**19. Chargeback/fraud handling stops at key revocation.** Gray-market resale, stolen-card team
purchases, serial refunders.
**Fix:** redemption-velocity limits, multi-refund email flags (fraud_flags table — doc 03 §9),
webhook-driven kill of both key and entitlements (designed), manual review path.

**20. PPP pricing undercuts the license model without geo-enforcement.** Regional pricing + a
3-device lifetime key invites VPN arbitrage and key resale.
**Fix:** cap PPP at ~40%, bind to card country via checkout, mark PPP licenses non-transferable
in the EULA.
