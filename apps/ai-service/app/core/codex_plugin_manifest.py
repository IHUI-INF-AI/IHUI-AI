# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex bundled-plugin manifest contract (R94).

Evidence surface: the shipped primary runtime bundle on this machine, read as plain files
(``runtime.json`` / ``.agents/plugins/marketplace.json`` / ``<plugin>/.codex-plugin/plugin.json``
/ ``<plugin>/.app.json`` / ``<plugin>/.agents``-adjacent ``agents/openai.yaml``
/ ``<plugin>/skills/<name>/SKILL.md``). Nothing here is transcribed from a guessed schema:
every key below was present in a real manifest, and the ones absent are recorded as absent.

Three contracts stack, and they are deliberately kept apart here:

1. the **marketplace** manifest lists plugins by ``name`` + ``source`` + ``policy`` + ``category``;
2. each **plugin** manifest adds 10 base keys and, for one plugin, a single ``apps`` pointer;
3. each **skill** inside a plugin opens with a two-key YAML frontmatter.

Honest boundary: the shipped bundle has exactly five plugins, so a six-key or
fifteen-key variant of the interface block is *unobserved*, not *impossible*.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Final, cast

# --- marketplace layer -------------------------------------------------------------

MARKETPLACE_NAME: Final = "openai-primary-runtime"
MARKETPLACE_PLUGIN_COUNT: Final = 5
MARKETPLACE_KEYS: Final = ("name", "plugins")
MARKETPLACE_ENTRY_KEYS: Final = ("name", "source", "policy", "category")
SOURCE_KEYS: Final = ("source", "path")
SOURCE_KINDS: Final = ("local",)
POLICY_KEYS: Final = ("installation", "authentication")
POLICY_INSTALLATION_VALUES: Final = ("AVAILABLE",)
POLICY_AUTHENTICATION_VALUES: Final = ("ON_USE",)

# --- plugin layer ------------------------------------------------------------------

PLUGIN_COUNT: Final = 5
TOP_LEVEL_KEYS_BASE: Final = (
    "author",
    "description",
    "homepage",
    "interface",
    "keywords",
    "license",
    "name",
    "repository",
    "skills",
    "version",
)
TOP_LEVEL_KEYS_OPTIONAL: Final = ("apps",)
TOP_LEVEL_KEYS: Final = TOP_LEVEL_KEYS_BASE + TOP_LEVEL_KEYS_OPTIONAL
AUTHOR_KEYS: Final = ("name", "email", "url")
INTERFACE_KEYS: Final = (
    "brandColor",
    "capabilities",
    "category",
    "composerIcon",
    "defaultPrompt",
    "developerName",
    "displayName",
    "logo",
    "longDescription",
    "privacyPolicyURL",
    "screenshots",
    "shortDescription",
    "termsOfServiceURL",
    "websiteURL",
)
INTERFACE_KEY_COUNT: Final = len(INTERFACE_KEYS)
CAPABILITIES_OBSERVED: Final = ("Interactive", "Write")
CATEGORY_OBSERVED: Final = "Productivity"
SKILLS_FIELD: Final = "./skills/"
BUNDLE_VERSION: Final = "26.1112.11217"

PLUGINS: Final[Mapping[str, Mapping[str, object]]] = {
    "documents": {
        "brand_color": "#2563EB",
        "keyword_count": 12,
        "skills": ("documents",),
        "skill_chars": 41395,
        "has_apps": False,
    },
    "pdf": {
        "brand_color": "#DC2626",
        "keyword_count": 12,
        "skills": ("pdf",),
        "skill_chars": 7809,
        "has_apps": False,
    },
    "presentations": {
        "brand_color": "#C43E1C",
        "keyword_count": 10,
        "skills": ("presentations",),
        "skill_chars": 29098,
        "has_apps": False,
    },
    "spreadsheets": {
        "brand_color": "#107C41",
        "keyword_count": 16,
        "skills": ("excel-live-control", "spreadsheets"),
        "skill_chars": 137086,
        "has_apps": True,
    },
    "template-creator": {
        "brand_color": "#10A37F",
        "keyword_count": 15,
        "skills": ("template-creator",),
        "skill_chars": 19034,
        "has_apps": False,
    },
}

# --- app connector layer (only one plugin carries it) ------------------------------

APP_KEYS: Final = ("apps",)
APP_CONNECTORS: Final[Mapping[str, Mapping[str, Mapping[str, str]]]] = {
    "spreadsheets": {
        "connected_documents": {"id": "connector_openai_codex_document_control"},
    },
}
APP_CONNECTOR_COUNT: Final = 1

# --- skill layer -------------------------------------------------------------------

SKILL_FRONTMATTER_KEYS: Final = ("name", "description")
SKILL_FRONTMATTER_KEY_COUNT: Final = 2
SKILL_FILE_NAME: Final = "SKILL.md"
SKILL_TOTAL_COUNT: Final = sum(
    len(cast("Sequence[object]", p["skills"])) for p in PLUGINS.values()
)
SKILL_TOTAL_CHARS: Final = sum(
    int(cast("int | str", p["skill_chars"])) for p in PLUGINS.values()
)

# --- per-skill agent manifest ------------------------------------------------------

AGENT_MANIFEST_FILE: Final = "agents/openai.yaml"
AGENT_MANIFEST_ROOT_KEY: Final = "interface"
AGENT_MANIFEST_KEYS: Final = (
    "brand_color",
    "default_prompt",
    "display_name",
    "icon_large",
    "icon_small",
    "short_description",
)
AGENT_MANIFEST_KEY_COUNT: Final = len(AGENT_MANIFEST_KEYS)

# --- runtime bundle metadata -------------------------------------------------------

RUNTIME_KEYS: Final = (
    "artifactToolVersion",
    "bundleFormatVersion",
    "bundleVersion",
    "bundledPlugins",
    "bundledSkills",
    "libreOfficeVersion",
    "nativeDependencies",
    "nodeVersion",
    "pnpmVersion",
    "pythonVersion",
    "skillsToRemove",
    "targetArch",
    "targetPlatform",
)
RUNTIME_KEY_COUNT: Final = len(RUNTIME_KEYS)
RUNTIME_PLUGIN_ENTRIES: Final = 1
RUNTIME_BUNDLED_SKILL_COUNT: Final = 0
RUNTIME_NATIVE_DEPENDENCIES: Final = ("libheif", "jxrlib", "poppler", "powershell", "git")
RUNTIME_NATIVE_DEPENDENCY_COUNT: Final = len(RUNTIME_NATIVE_DEPENDENCIES)
RUNTIME_SKILLS_TO_REMOVE: Final = (
    "codex-primary-runtime/spreadsheets",
    "codex-primary-runtime/slides",
    "doc",
    "docs",
    "spreadsheet",
    "slides",
)
RUNTIME_SKILLS_TO_REMOVE_COUNT: Final = len(RUNTIME_SKILLS_TO_REMOVE)
RUNTIME_NODE_VERSION: Final = "24.22.1-cua.1"
RUNTIME_PNPM_VERSION: Final = "11.25.0"
RUNTIME_PYTHON_VERSION: Final = "3.12.14"
RUNTIME_TARGET: Final = ("win32", "x64")
RUNTIME_LIBREOFFICE_ABSENT: Final = True


class PluginManifestError(ValueError):
    """Raised when a plugin fact contradicts the observed bundle contract."""


def plugin_of(name: str) -> Mapping[str, object]:
    """Return the fact row for ``name``, or raise."""
    try:
        return PLUGINS[name]
    except KeyError:
        raise PluginManifestError(f"unknown plugin: {name!r}") from None


def brand_of(name: str) -> str:
    """Return the manifest ``interface.brandColor`` for ``name``."""
    return str(plugin_of(name)["brand_color"])


def skills_of(name: str) -> tuple[str, ...]:
    """Return the skill directory names shipped inside ``name``."""
    skills = plugin_of(name)["skills"]
    if not isinstance(skills, tuple):
        raise PluginManifestError(f"{name}: skills is not a tuple")
    return skills


def keywords_of(name: str) -> int:
    """Return the manifest ``keywords`` array length for ``name``."""
    return int(cast("int | str", plugin_of(name)["keyword_count"]))


def skill_chars_of(name: str) -> int:
    """Return the summed ``SKILL.md`` character count for ``name``."""
    return int(cast("int | str", plugin_of(name)["skill_chars"]))


def carries_apps(name: str) -> bool:
    """Whether ``name`` ships the optional ``apps`` pointer."""
    return bool(plugin_of(name)["has_apps"])


def plugins_with_apps() -> tuple[str, ...]:
    """Names of plugins carrying ``apps``; the contract has exactly one."""
    return tuple(n for n in PLUGINS if carries_apps(n))


def validate_plugins() -> None:
    """Assert every cross-plugin invariant the bundle actually exhibits.

    Each check encodes an equality that held for all five manifests, so a future
    bundle that breaks one of them fails loud instead of silently drifting.
    """
    if len(PLUGINS) != PLUGIN_COUNT:
        raise PluginManifestError(f"expected {PLUGIN_COUNT} plugins, got {len(PLUGINS)}")
    if set(TOP_LEVEL_KEYS) != set(TOP_LEVEL_KEYS_BASE) | set(TOP_LEVEL_KEYS_OPTIONAL):
        raise PluginManifestError("TOP_LEVEL_KEYS does not compose from base + optional")
    if len(INTERFACE_KEYS) != INTERFACE_KEY_COUNT:
        raise PluginManifestError("INTERFACE_KEYS length drifted")
    if len(set(INTERFACE_KEYS)) != INTERFACE_KEY_COUNT:
        raise PluginManifestError("INTERFACE_KEYS contains a duplicate")
    if len(plugins_with_apps()) != APP_CONNECTOR_COUNT:
        raise PluginManifestError(
            f"expected {APP_CONNECTOR_COUNT} plugin with apps, got {plugins_with_apps()}"
        )
    for name, row in PLUGINS.items():
        if not name:
            raise PluginManifestError("empty plugin name")
        brand = str(row["brand_color"])
        if not brand.startswith("#") or len(brand) != 7:
            raise PluginManifestError(f"{name}: brand_color {brand!r} is not #rrggbb")
        skills = row["skills"]
        if not isinstance(skills, tuple) or not skills:
            raise PluginManifestError(f"{name}: skills must be a non-empty tuple")
        if len(set(skills)) != len(skills):
            raise PluginManifestError(f"{name}: duplicate skill name")
        chars = int(row["skill_chars"])  # type: ignore[call-overload]
        if chars <= 0:
            raise PluginManifestError(f"{name}: skill_chars must be positive")
    if SKILL_TOTAL_COUNT != 6:
        raise PluginManifestError(f"expected 6 skills across plugins, got {SKILL_TOTAL_COUNT}")
    if SKILL_TOTAL_CHARS != 234422:
        raise PluginManifestError(f"expected 234422 total skill chars, got {SKILL_TOTAL_CHARS}")
    if len(RUNTIME_KEYS) != RUNTIME_KEY_COUNT:
        raise PluginManifestError("RUNTIME_KEYS length drifted")
    if RUNTIME_BUNDLED_SKILL_COUNT != 0:
        raise PluginManifestError("bundle is expected to ship zero standalone skills")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
