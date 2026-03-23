---
name: release-notes
description: Write clear, user-focused release notes that explain what changed, why it matters, and how to use it. Outputs release notes for in-app changelogs, emails, blog posts, and developer documentation.
argument-hint: [features shipped, audience (users or developers), tone (casual or formal)]
allowed-tools: Read, Write
---

# Release Notes Writer

Release notes are marketing. They tell your users that you are listening to them, that you are investing in the product, and that their experience is getting better. Bad release notes list features; good release notes explain benefits. The best release notes make users excited to open the product and try something new.

## Audience and Format Selection

| Audience | Format | Tone | Length |
|----------|--------|------|--------|
| End users (non-technical) | In-app changelog or email | Conversational, benefit-focused | 1-3 sentences per feature |
| Developers / API users | Developer docs / API changelog | Technical, precise | Full code examples where relevant |
| Enterprise accounts | Email or PDF | Professional, business-impact | Summary + details |
| Internal / stakeholders | Slack or internal wiki | Factual, complete | Full details including limitations |
| Public (blog / press) | Blog post | Narrative, feature-highlight | Story-driven, longer |

## Feature Framing: From Engineering to User

Engineering language → User language:

| Engineering | User-facing |
|------------|-------------|
| "Added status field to the integrations endpoint" | "You can now see at a glance which integrations are healthy and which need attention" |
| "Implemented idempotency keys on order creation" | "Creating the same order twice now automatically prevents duplicate charges" |
| "Reduced P99 sync latency from 8s to 1.2s" | "Integrations are now 6x faster — your data syncs in seconds, not minutes" |
| "Fixed null pointer exception in user invite flow" | "Fixed a bug where some team invites failed to send" |

## Process

1. **Gather the changes** — what shipped in this release? Include features, improvements, and bug fixes.
2. **Categorize** — new features / improvements / bug fixes / deprecations.
3. **Write the headline** — what is the most important thing in this release?
4. **Frame each change as a benefit** — what can users do now that they couldn't before?
5. **Include a call to action** — how do users try this? Where do they go?
6. **Add visuals for major features** — a screenshot or GIF is worth 300 words.
7. **Proofread for jargon** — read it as a non-technical user.

## Output Format

### In-App Changelog Entry

**[Month] [Year] Update**

**🎉 What's new**

**[Feature headline — benefit, not feature name]**
[1-2 sentences describing what users can now do. Lead with the user benefit.]
[Optional: Call to action — "Try it now →"]

**[Second feature headline]**
[1-2 sentences.]

**⚡ Improvements**
- [Improvement]: [Brief description of what got better and why it matters]
- [Improvement]: [Brief description]

**🐛 Bug fixes**
- Fixed an issue where [symptom that users experienced]. [Impact: "This affected users who..."]
- Fixed [brief description of fix].

---

### Email Release Announcement

**Subject line options** (test these):
- Straightforward: "What's new in [Product]: [Top Feature Name]"
- Benefit-led: "See all your integrations at a glance — new in [Product]"
- Curiosity: "[Month] update: the feature you've been waiting for"

---

Hi [First Name],

[Opening that connects to a pain they know — 1 sentence]

[Feature 1 headline — big and bold]

[2-3 sentences describing the benefit in plain language. What will they do with it? How does it make their day better?]

[Image or GIF showing the feature in action]

[CTA button: "Try [Feature Name] →"]

---

**Also in this update:**
- **[Feature 2]:** [1 sentence benefit]
- **[Improvement]:** [1 sentence]
- **Bug fix:** Fixed [issue that was affecting users]

[Closing — optional: tease next update]

[Your name]
[Product team]

P.S. [Optional: direct link to docs, feedback form, or specific call to action]

---

### Developer / API Release Notes

**API Version:** [X.Y.Z] | **Release Date:** [YYYY-MM-DD]

#### Breaking Changes
*Review these before updating to this version.*

**[Change name]**
- **What changed:** [Technical description]
- **Why:** [Business or technical reason]
- **Migration:** [Specific steps to update]
- **Deadline:** [If applicable — when old behavior is removed]
- **Example:**

```http
# Before
GET /api/v1/integrations
→ { "id": "...", "user_id": "..." }

# After
GET /api/v2/integrations
→ { "id": "...", "user": { "id": "...", "email": "..." } }
```

#### New Features

**[Feature Name]**
**Endpoint:** `POST /api/v2/integrations/{id}/retry`

[Description of what it does and when to use it]

```bash
curl -X POST https://api.example.com/v2/integrations/int_abc123/retry   -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "integration_id": "int_abc123",
  "status": "retry_queued",
  "estimated_completion": "2024-03-15T10:35:00Z"
}
```

**Notes:**
- Rate limited to 5 retries per integration per hour
- Returns 409 if integration is currently syncing
- Returns 422 if integration has been disabled

#### Deprecated
The following features will be removed in v3.0 (target: June 2024):

| Deprecated | Replacement | Reason |
|-----------|-------------|--------|
| `user_id` field on order response | `user.id` in nested `user` object | Consistency with other endpoints |
| `GET /api/v1/status` | `GET /api/v2/integrations/{id}/health` | More granular and real-time |

---

### Worked Examples

**Bad:** "Added integration retry functionality to the integration management interface."

**Good:** "You can now retry a failed sync with one click — no more waiting for the next scheduled sync or contacting support for transient failures."

---

**Bad:** "Fixed NPE in webhook delivery service."

**Good:** "Fixed a bug where webhooks occasionally failed to deliver for events with empty payloads. If you noticed missing webhook events, this is now resolved."

---

**Bad:** "Performance improvements."

**Good:** "Sync times for large integrations (10,000+ records) are now 6x faster. A sync that previously took 3 hours now completes in ~30 minutes."

---

### Changelog Frequency and Categories

| Category | When to Include | User Sees |
|---------|----------------|---------|
| New features | Always | "What's new" / "🎉" |
| Performance improvements | If user-perceptible | "Improvements" |
| Bug fixes (user-visible) | Yes | "Bug fixes" |
| Bug fixes (internal) | Usually no | Skip unless caused user pain |
| Security patches | Brief mention | "Security updates" — no details |
| Infrastructure changes | No | Skip |
| Deprecations | Yes, with timeline | "Deprecation notice" |

## Rules

- **Lead with the benefit, not the feature** — "you can now..." not "we added...".
- **One sentence per feature for end users** — if you need three sentences, the feature needs better UX.
- **Visuals for anything visual** — a screenshot communicates UI changes better than any description.
- **No jargon for end-user notes** — if you wouldn't say it in conversation, don't write it.
- **Acknowledge what you fixed** — don't bury bug fixes; users who were affected feel heard when you name it.
- **Be specific about performance** — "6x faster" not "improved performance".
- **Include a call to action** — tell users where to go to try the thing.
- **Separate developer and user notes** — API changes don't belong in the end-user changelog.
- **Deprecation notices require timelines** — "being deprecated" without a date is useless; "removed June 2024" is actionable.
- **Write it before shipping** — release notes written after the fact lack the context of someone who designed the feature.