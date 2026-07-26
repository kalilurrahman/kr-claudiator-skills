---
name: plugin-architecture
description: Design extensible plugin systems that let third parties extend your application without modifying core code. Outputs plugin interface design, registry patterns, sandboxing strategy, and versioning contracts.
argument-hint: [extension points needed, language, security requirements, plugin author audience]
allowed-tools: Read, Write
---

# Plugin Architecture

A plugin architecture makes your application extensible without modifying its core. Users, customers, or third-party developers add functionality by writing plugins that conform to a defined interface. Done well, it creates a platform. Done poorly, it creates a security hole and a maintenance nightmare.

## Process

1. **Define extension points.** Where should plugins hook in? Data transformation, UI rendering, event handling, command registration. Be conservative — every extension point is a contract you must maintain.
2. **Design the plugin interface.** What methods must every plugin implement? What does the host provide to plugins (the API surface)?
3. **Choose the execution model.** In-process (fast, less isolated) or out-of-process (slower, sandboxed). Higher trust plugins → in-process. Untrusted third parties → out-of-process.
4. **Build the registry.** How are plugins discovered, loaded, and managed?
5. **Version the interface.** Plugins break when the interface changes. Version it from day one.
6. **Sandbox untrusted plugins.** Limit what plugins can access — file system, network, other plugins.

## Plugin Interface Design

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

@dataclass
class PluginManifest:
    """Metadata every plugin must provide."""
    name: str
    version: str
    description: str
    author: str
    interface_version: str    # Which version of the plugin API this supports
    permissions: list[str]    # Declared permissions: ["file:read", "network", "storage"]

class DataProcessorPlugin(ABC):
    """Extension point: data transformation pipeline."""

    @property
    @abstractmethod
    def manifest(self) -> PluginManifest:
        ...

    @abstractmethod
    def can_handle(self, data_type: str) -> bool:
        """Returns True if this plugin handles this data type."""
        ...

    @abstractmethod
    def process(self, data: Any, context: "PluginContext") -> Any:
        """Process data and return transformed result."""
        ...

    def on_load(self) -> None:
        """Called once when plugin is loaded. Optional."""

    def on_unload(self) -> None:
        """Called before plugin is removed. Optional."""


class PluginContext:
    """API surface available to plugins — host provides this."""

    def __init__(self, plugin_name: str, permissions: list[str], storage_path: str):
        self._plugin_name = plugin_name
        self._permissions = set(permissions)
        self._storage = storage_path

    def log(self, level: str, message: str) -> None:
        import logging
        logging.getLogger(f"plugin.{self._plugin_name}").log(
            getattr(logging, level.upper()), message
        )

    def get_config(self, key: str) -> Optional[str]:
        """Plugins access config through this — not raw env vars."""
        import os
        return os.environ.get(f"PLUGIN_{self._plugin_name.upper()}_{key.upper()}")

    def read_file(self, path: str) -> bytes:
        if "file:read" not in self._permissions:
            raise PermissionError("Plugin does not have file:read permission")
        import pathlib
        # Restrict to plugin's sandbox directory
        safe_path = pathlib.Path(self._storage) / path
        if not safe_path.resolve().is_relative_to(pathlib.Path(self._storage).resolve()):
            raise PermissionError("Path traversal denied")
        return safe_path.read_bytes()

    def store(self, key: str, value: Any) -> None:
        """Persistent key-value store scoped to this plugin."""
        ...
```

## Plugin Registry

```python
import importlib
import importlib.util
import sys
from pathlib import Path

class PluginRegistry:
    def __init__(self, interface_version: str = "1.0"):
        self._plugins: dict[str, DataProcessorPlugin] = {}
        self._interface_version = interface_version

    def discover(self, plugins_dir: str) -> list[str]:
        """Scan directory for plugin modules."""
        found = []
        for path in Path(plugins_dir).glob("*/plugin.py"):
            try:
                plugin = self._load_from_path(path)
                self.register(plugin)
                found.append(plugin.manifest.name)
            except Exception as e:
                print(f"Failed to load plugin at {path}: {e}")
        return found

    def _load_from_path(self, path: Path) -> DataProcessorPlugin:
        spec = importlib.util.spec_from_file_location(path.parent.name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find the plugin class (must subclass DataProcessorPlugin)
        plugin_class = None
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type) and issubclass(attr, DataProcessorPlugin)
                    and attr is not DataProcessorPlugin):
                plugin_class = attr
                break

        if not plugin_class:
            raise ValueError(f"No DataProcessorPlugin subclass found in {path}")

        plugin = plugin_class()
        manifest = plugin.manifest

        # Validate interface version compatibility
        if manifest.interface_version != self._interface_version:
            raise ValueError(
                f"Plugin {manifest.name} requires interface v{manifest.interface_version}, "
                f"host provides v{self._interface_version}"
            )

        return plugin

    def register(self, plugin: DataProcessorPlugin) -> None:
        name = plugin.manifest.name
        if name in self._plugins:
            raise ValueError(f"Plugin '{name}' already registered")
        plugin.on_load()
        self._plugins[name] = plugin

    def unregister(self, name: str) -> None:
        if name in self._plugins:
            self._plugins[name].on_unload()
            del self._plugins[name]

    def get_for_type(self, data_type: str) -> list[DataProcessorPlugin]:
        return [p for p in self._plugins.values() if p.can_handle(data_type)]

    def list_plugins(self) -> list[PluginManifest]:
        return [p.manifest for p in self._plugins.values()]
```

## Example Plugin Implementation

```python
# plugins/csv-enricher/plugin.py
from my_app.plugins import DataProcessorPlugin, PluginManifest, PluginContext
import csv, io

class CSVEnricherPlugin(DataProcessorPlugin):

    @property
    def manifest(self) -> PluginManifest:
        return PluginManifest(
            name="csv-enricher",
            version="1.2.0",
            description="Adds computed columns to CSV data",
            author="Acme Corp",
            interface_version="1.0",
            permissions=["storage"],
        )

    def can_handle(self, data_type: str) -> bool:
        return data_type == "text/csv"

    def process(self, data: Any, context: PluginContext) -> Any:
        context.log("info", "Starting CSV enrichment")
        reader = csv.DictReader(io.StringIO(data))
        rows = list(reader)

        for row in rows:
            # Add computed column
            if "price" in row and "quantity" in row:
                row["total"] = str(float(row["price"]) * int(row["quantity"]))

        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return output.getvalue()
```

## Out-of-Process Sandboxing (for Untrusted Plugins)

```python
# Run untrusted plugins in subprocess with restricted resources
import subprocess, json, resource

def run_sandboxed_plugin(plugin_path: str, data: Any, timeout: int = 5) -> Any:
    """Execute plugin in isolated subprocess."""
    proc = subprocess.run(
        ["python3", "-c", f"""
import sys, json, resource
# Restrict: 64MB memory, no network (handled at OS level with seccomp/namespaces)
resource.setrlimit(resource.RLIMIT_AS, (64 * 1024 * 1024, 64 * 1024 * 1024))
sys.path.insert(0, '{plugin_path}')
import plugin
p = plugin.Plugin()
data = json.loads(sys.stdin.read())
result = p.process(data, None)
print(json.dumps(result))
        """],
        input=json.dumps(data).encode(),
        capture_output=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Plugin failed: {proc.stderr.decode()}")
    return json.loads(proc.stdout.decode())
```

## Plugin Versioning

```markdown
## Interface Versioning Contract

Interface version: MAJOR.MINOR

MINOR bump: Additive changes (new optional methods, new context APIs)
  Plugins on v1.0 still work with v1.1 host
  Host checks: plugin_version.major == host_version.major

MAJOR bump: Breaking changes (removed methods, changed signatures)
  Must increment, plugins must update
  Host rejects plugins on wrong major version

## Plugin manifest declares supported interface version
## Host validates on load, refuses incompatible plugins
## Keep changelog of interface changes in docs/PLUGIN_API.md
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No interface versioning** | Updating host breaks all plugins | Version interface from day one |
| **Plugins access global state** | Tight coupling; plugins interfere with each other | All host access through PluginContext only |
| **No sandboxing for untrusted code** | Malicious plugin reads secrets or crashes host | Out-of-process execution for untrusted plugins |
| **Too many extension points** | Every extension point is a contract to maintain | Start with one; add only when needed |
| **Loading plugins synchronously at startup** | Slow startup; one bad plugin blocks all | Lazy load; catch and log individual plugin failures |

## 10 Rules

1. Every extension point is a contract — add only what you will maintain forever.
2. Version the plugin interface from day one — changes without versions break plugins silently.
3. Plugins access the host through a defined context API — never global state.
4. In-process for trusted plugins; out-of-process with resource limits for untrusted.
5. Plugin discovery and loading failures are isolated — one bad plugin never blocks others.
6. Declare permissions in the manifest — plugins state what they need, hosts enforce it.
7. Plugin on_load and on_unload lifecycle hooks enable clean resource management.
8. Keep the plugin API surface small — every method you expose is complexity you maintain.
9. Test plugins against a contract test suite — the host provides a test harness.
10. Document the full plugin API in one place — plugin authors need complete, stable reference docs.
