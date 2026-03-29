---
name: null-object-pattern
description: Eliminate null checks and NullPointerExceptions using the Null Object pattern. Outputs null object implementations, optional type usage, and refactoring strategies for null-heavy codebases.
argument-hint: [language, null hotspots, codebase scale, nullable vs non-nullable types]
allowed-tools: Read, Write
---

# Null Object Pattern

The Null Object pattern replaces null references with objects that implement the expected interface but do nothing (or return safe defaults). It eliminates scattered null checks, reduces NullPointerExceptions, and produces cleaner, more readable code.

## The Problem

```python
# BEFORE: null checks everywhere
def send_notification(order: Optional[Order], user: Optional[User]) -> None:
    if order is None:
        return
    if user is None:
        return
    if user.email is None:
        return
    if user.notification_preferences is None:
        send_email(user.email, format_order(order))
    elif user.notification_preferences.email_enabled:
        send_email(user.email, format_order(order))

# AFTER: null objects handle the no-op case
def send_notification(order: Order, user: User) -> None:
    # Both are guaranteed to be valid objects (or null objects)
    if user.wants_email_notification():
        send_email(user.email, format_order(order))
```

## Implementation

```python
from abc import ABC, abstractmethod
from typing import Optional

# Interface
class NotificationService(ABC):
    @abstractmethod
    def send_email(self, to: str, subject: str, body: str) -> None: ...
    
    @abstractmethod
    def send_sms(self, to: str, message: str) -> None: ...
    
    @property
    @abstractmethod
    def is_available(self) -> bool: ...

# Real implementation
class SendGridNotificationService(NotificationService):
    def send_email(self, to: str, subject: str, body: str) -> None:
        sendgrid_client.send(to=to, subject=subject, body=body)
    
    def send_sms(self, to: str, message: str) -> None:
        twilio_client.send(to=to, message=message)
    
    @property
    def is_available(self) -> bool:
        return True

# Null object — does nothing safely
class NullNotificationService(NotificationService):
    """Used when notifications are disabled, user opted out, or in tests."""
    
    def send_email(self, to: str, subject: str, body: str) -> None:
        pass  # Intentional no-op
    
    def send_sms(self, to: str, message: str) -> None:
        pass  # Intentional no-op
    
    @property
    def is_available(self) -> bool:
        return False

# Null user
class NullUser:
    """Represents an anonymous/unknown user — eliminates user null checks."""
    
    id = "anonymous"
    email = None
    name = "Guest"
    is_authenticated = False
    
    def wants_email_notification(self) -> bool:
        return False
    
    def has_permission(self, _permission: str) -> bool:
        return False
    
    def get_preference(self, key: str, default=None):
        return default

# Factory method — returns null object instead of None
class UserRepository:
    async def get(self, user_id: str) -> 'User':
        record = await db.fetchone("SELECT * FROM users WHERE id = $1", [user_id])
        if not record:
            return NullUser()  # Never return None
        return User.from_record(record)
```

## Optional Types (Modern Python)

```python
# Using Optional with explicit checks at boundaries only
from typing import Optional

# Repository returns Optional — caller handles at boundary
async def get_user(user_id: str) -> Optional[User]:
    ...

# Service converts Optional to Null Object at the boundary
async def process_for_user(user_id: str):
    user = await user_repo.get(user_id) or NullUser()
    # From here on, user is always a valid User-like object
    await notification_service.notify(user, message)
    await audit_log.record(user.id, "processed")
```

## Logger Null Object

```python
import logging

class NullLogger:
    """Drop-in replacement for logging.Logger — useful in tests."""
    def debug(self, *args, **kwargs): pass
    def info(self, *args, **kwargs): pass
    def warning(self, *args, **kwargs): pass
    def error(self, *args, **kwargs): pass
    def exception(self, *args, **kwargs): pass

# Usage in class — accepts real or null logger
class DataProcessor:
    def __init__(self, logger=None):
        self._logger = logger or NullLogger()
    
    def process(self, data):
        self._logger.info("Processing %d records", len(data))
        # No null check needed
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Null object that raises errors** | Defeats the purpose — use exceptions instead | Null objects silently do nothing or return safe defaults |
| **Returning None from repositories** | Every caller checks for None | Return null objects; let callers check `is_null` if needed |
| **Null objects hiding bugs** | Missing data silently ignored when it shouldn't be | Use null objects only where absence is a valid state |
| **Too many null object variants** | Maintenance burden | One null object per interface |
| **Mixing null objects and None** | Inconsistent; defeats the pattern | Commit to the pattern; never return None from the same method |

## 10 Rules

1. Null objects implement the same interface as real objects — callers don't need to check.
2. Null object methods are safe no-ops or return safe defaults — never raise exceptions.
3. Repositories return null objects, not None — eliminates null checks at every call site.
4. Null objects are immutable singletons — one instance shared everywhere.
5. Use `is_null` property if callers legitimately need to know — but most shouldn't.
6. Null objects are most valuable at boundaries: repositories, services, external clients.
7. Tests use null objects by default — real implementations only for integration tests.
8. The Null Object pattern is complementary to Optional types — use them at different layers.
9. Document null objects clearly — engineers need to know what they are and why.
10. Don't use null objects to hide missing required data — only where absence is valid.
