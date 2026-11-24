# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The render toolchain: three env vars, a runtime python, and finally pictures (R108).

Through R107 every gate was exercised against a synthetic deck, and none of them could show a
human what the deck looked like. ``render_slides.py`` and ``create_montage.py`` close that loop.
Getting them to run took four separate failures, and the shape of those failures is the real
finding: these tools are not standalone Python scripts, they are bound to a runtime that has to
be handed to them explicitly.

**Failure 1 -- wrong interpreter.**
Run under the repo's venv:

    ModuleNotFoundError: No module named 'pdf2image'

The runtime declares its own dependency set. Under the runtime's python:

    pdf2image True / pypdfium2 True / PIL True / lxml True

So the tool must run under ``<runtime>/dependencies/python/python.exe``, not any venv.

**Failure 2 -- missing env var.**

    RuntimeError: RUNTIME_NODE is required.

``runtime_helpers.py`` reads ``RUNTIME_NODE`` and demands an absolute path to an existing file.

**Failure 3 -- a second env var, reached only after the first is satisfied.**

    RuntimeError: RUNTIME_BIN_DIR is required.

That one must be a directory, and it must contain ``native-executables.json``.

**Failure 4 -- the node side has its own variable, with a different name style.**

    Error: RUNTIME_NODE_MODULES or CODEX_PRIMARY_RUNTIME_NODE_MODULES is required.

Note the fallback: ``RUNTIME_NODE_MODULES`` wins if set, otherwise the runtime-branded name.

Only with all three set does rendering succeed:

    Slides rendered to .../png4
    rc=0
    slide-1.png  17,112 B

And the montage:

    Montage saved to .../montage.png
    rc=0
    montage.png  5,670 B

**One trap worth recording**: on the very first attempt the script printed a full Python
traceback and still exited **0**. A caller that trusts the exit code would file a rendered deck
that does not exist. The later failures exit 1. So the exit code is not a reliable judge on the
first path -- the *presence of the PNG* is.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- the two tools -------------------------------------------------------------------

RENDER_TOOL: Final = "render_slides.py"
RENDER_TOOL_BYTES: Final = 8_704
MONTAGE_TOOL: Final = "create_montage.py"
MONTAGE_TOOL_BYTES: Final = 10_650
RENDER_DESCRIPTION: Final = "Render slides to images."
MONTAGE_DESCRIPTION: Final = (
    "Create a montage with a fixed number of columns. Each image is resized isotropically "
    "to fit inside a cell of size (cell_width x cell_height)."
)

# --- render_slides arguments ---------------------------------------------------------

RENDER_POSITIONAL: Final = ("input_path",)
RENDER_INPUT_ACCEPTS: Final = ("PowerPoint", "PDF")
RENDER_OPTIONS: Final = ("--output_dir", "--width", "--height")
RENDER_DEFAULT_WIDTH: Final = 1600
RENDER_DEFAULT_HEIGHT: Final = 900
RENDER_SCALE_IS_ISOTROPIC: Final = True
RENDER_DEFAULT_OUTPUT_DIR: Final = "folder next to the input named after the input file"
RENDER_OUTPUT_PATTERN: Final = "slide-<N>.png"

# --- create_montage arguments --------------------------------------------------------

MONTAGE_INPUT_MODES: Final = ("--input_files", "--input_dir")
MONTAGE_INPUT_MODES_EXCLUSIVE: Final = True
MONTAGE_REQUIRED: Final = ("--output_file",)
MONTAGE_DEFAULT_NUM_COL: Final = 5
MONTAGE_OPTIONS: Final = (
    "--num_col",
    "--cell_width",
    "--cell_height",
    "--gap",
    "--label_mode",
    "--retain_converted_files",
    "--fail_on_image_error",
)
MONTAGE_LABEL_MODES: Final = ("number", "filename", "none")
MONTAGE_FORMAT_FROM_EXTENSION: Final = True

# --- failure 1: interpreter ----------------------------------------------------------

VENV_MISSING_MODULE: Final = "pdf2image"
VENV_ERROR_TEXT: Final = "ModuleNotFoundError: No module named 'pdf2image'"
RUNTIME_PYTHON_PATH_PARTS: Final = ("dependencies", "python", "python.exe")
RUNTIME_HAS_PDF2IMAGE: Final = True
RUNTIME_MODULES_OBSERVED: Final = ("pdf2image", "pypdfium2", "PIL", "lxml")
RUNTIME_LACKS: Final = ("fitz",)
MUST_USE_RUNTIME_PYTHON: Final = True

# --- failure 2-4: the env chain ------------------------------------------------------

RUNTIME_NODE_VAR: Final = "RUNTIME_NODE"
RUNTIME_BIN_DIR_VAR: Final = "RUNTIME_BIN_DIR"
RUNTIME_NODE_MODULES_VARS: Final = (
    "RUNTIME_NODE_MODULES",
    "CODEX_PRIMARY_RUNTIME_NODE_MODULES",
)
ENV_CHAIN: Final = (
    RUNTIME_NODE_VAR,
    RUNTIME_BIN_DIR_VAR,
    RUNTIME_NODE_MODULES_VARS[0],
)
ENV_CHAIN_LENGTH: Final = 3

RUNTIME_NODE_ERROR: Final = "RUNTIME_NODE is required."
RUNTIME_BIN_DIR_ERROR: Final = "RUNTIME_BIN_DIR is required."
RUNTIME_NODE_MODULES_ERROR: Final = (
    "RUNTIME_NODE_MODULES or CODEX_PRIMARY_RUNTIME_NODE_MODULES is required."
)
ALL_THREE_REQUIRED: Final = True
NODE_VAR_MUST_BE_ABSOLUTE_FILE: Final = True
BIN_DIR_MUST_BE_ABSOLUTE_DIRECTORY: Final = True
NODE_MODULES_MUST_BE_ABSOLUTE_DIRECTORY: Final = True
BIN_DIR_NEEDS_MANIFEST: Final = "native-executables.json"

OBSERVED_NODE_PATH_TAIL: Final = "dependencies/node/bin/node.exe"
OBSERVED_BIN_DIR_TAIL: Final = "dependencies/bin/override"
OBSERVED_NODE_MODULES_TAIL: Final = "dependencies/node/node_modules"
NODE_MODULES_PREFERENCE_RUNTIME_FIRST: Final = True

# --- the successful runs ------------------------------------------------------------

RENDERED_OUTPUT: Final = "slide-1.png"
RENDERED_BYTES: Final = 17_112
RENDER_SUCCESS_TEXT: Final = "Slides rendered to"
RENDER_EXIT_CODE: Final = 0
MONTAGE_OUTPUT_BYTES: Final = 5_670
MONTAGE_SUCCESS_TEXT: Final = "Montage saved to"
MONTAGE_EXIT_CODE: Final = 0
RENDER_TOOK_ENV_CHAIN: Final = True
MONTAGE_WORKED_AFTER_RENDER: Final = True

# --- the exit-code trap -------------------------------------------------------------

FIRST_ATTEMPT_EXIT_CODE: Final = 0
FIRST_ATTEMPT_HAD_TRACEBACK: Final = True
FIRST_ATTEMPT_PRODUCED_PNG: Final = False
LATER_FAILURES_EXIT_CODE: Final = 1
EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH: Final = False
PRESENCE_OF_PNG_IS_THE_JUDGE: Final = True
CLOSES_VISUAL_VERIFICATION_GAP: Final = True


class RenderToolchainError(ValueError):
    """Raised when the toolchain contract is softened."""


def env_chain_complete(env: Mapping[str, str]) -> bool:
    """Rendering needs all three variables, not a subset."""
    return all(name in env and env[name] for name in ENV_CHAIN)


def exit_code_is_reliable(had_traceback: bool) -> bool:
    """A traceback can ride on exit 0; only a clean run's zero means success."""
    return not had_traceback


def render_can_judge_by_output(png_exists: bool) -> bool:
    """The PNG's presence is the real verdict."""
    return png_exists


def toolchain_contract() -> Mapping[str, object]:
    """The chain as facts."""
    return {
        "env_chain": ENV_CHAIN_LENGTH,
        "runtime_python_required": MUST_USE_RUNTIME_PYTHON,
        "render_bytes": RENDERED_BYTES,
        "montage_bytes": MONTAGE_OUTPUT_BYTES,
        "exit_zero_can_lie": not EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH,
    }


def validate_toolchain_contract() -> None:
    """Assert the chain and the exit-code trap."""
    if RENDER_TOOL != "render_slides.py" or MONTAGE_TOOL != "create_montage.py":
        raise RenderToolchainError("tool identities drifted")
    if RENDER_DESCRIPTION != "Render slides to images.":
        raise RenderToolchainError("render description is evidence")
    if "fixed number of columns" not in MONTAGE_DESCRIPTION:
        raise RenderToolchainError("montage description is evidence")

    if RENDER_POSITIONAL != ("input_path",):
        raise RenderToolchainError("one positional")
    if RENDER_INPUT_ACCEPTS != ("PowerPoint", "PDF"):
        raise RenderToolchainError("two accepted input kinds")
    if len(RENDER_OPTIONS) != 3:
        raise RenderToolchainError("three render options")
    if RENDER_DEFAULT_WIDTH != 1600 or RENDER_DEFAULT_HEIGHT != 900:
        raise RenderToolchainError("default dimensions drifted")
    if not RENDER_SCALE_IS_ISOTROPIC:
        raise RenderToolchainError("scaling is isotropic")
    if RENDER_OUTPUT_PATTERN != "slide-<N>.png":
        raise RenderToolchainError("output naming drifted")

    if len(MONTAGE_INPUT_MODES) != 2 or not MONTAGE_INPUT_MODES_EXCLUSIVE:
        raise RenderToolchainError("two exclusive input modes")
    if MONTAGE_REQUIRED != ("--output_file",):
        raise RenderToolchainError("output file is required")
    if MONTAGE_DEFAULT_NUM_COL != 5:
        raise RenderToolchainError("five columns by default")
    if len(MONTAGE_OPTIONS) != 7:
        raise RenderToolchainError("seven montage options")
    if MONTAGE_LABEL_MODES != ("number", "filename", "none"):
        raise RenderToolchainError("three label modes")

    if VENV_MISSING_MODULE != "pdf2image":
        raise RenderToolchainError("the venv lacks pdf2image")
    if "No module named" not in VENV_ERROR_TEXT:
        raise RenderToolchainError("the error text is evidence")
    if RUNTIME_HAS_PDF2IMAGE is not True:
        raise RenderToolchainError("the runtime has pdf2image")
    if len(RUNTIME_MODULES_OBSERVED) != 4:
        raise RenderToolchainError("four modules were probed present")
    if MUST_USE_RUNTIME_PYTHON is not True:
        raise RenderToolchainError("the runtime python is mandatory")

    if ENV_CHAIN_LENGTH != 3 or len(ENV_CHAIN) != 3:
        raise RenderToolchainError("three env vars")
    if ENV_CHAIN != (RUNTIME_NODE_VAR, RUNTIME_BIN_DIR_VAR, "RUNTIME_NODE_MODULES"):
        raise RenderToolchainError("env chain order drifted")
    if not env_chain_complete(dict.fromkeys(ENV_CHAIN, "x")):
        raise RenderToolchainError("all three together")
    if env_chain_complete({RUNTIME_NODE_VAR: "x", RUNTIME_BIN_DIR_VAR: "y"}):
        raise RenderToolchainError("two is not enough")
    if ALL_THREE_REQUIRED is not True:
        raise RenderToolchainError("all three are required")
    if len(RUNTIME_NODE_MODULES_VARS) != 2:
        raise RenderToolchainError("one variable, two accepted names")
    if not NODE_MODULES_PREFERENCE_RUNTIME_FIRST:
        raise RenderToolchainError("RUNTIME_NODE_MODULES wins when both are set")
    if BIN_DIR_NEEDS_MANIFEST != "native-executables.json":
        raise RenderToolchainError("bin dir needs its manifest")

    if RENDERED_OUTPUT != "slide-1.png" or RENDERED_BYTES != 17_112:
        raise RenderToolchainError("render output is the observed one")
    if RENDER_EXIT_CODE != 0 or MONTAGE_EXIT_CODE != 0:
        raise RenderToolchainError("both succeeded")
    if MONTAGE_OUTPUT_BYTES != 5_670:
        raise RenderToolchainError("montage bytes are the observed ones")
    if RENDER_TOOK_ENV_CHAIN is not True or MONTAGE_WORKED_AFTER_RENDER is not True:
        raise RenderToolchainError("the chain was needed, then the montage worked")

    if FIRST_ATTEMPT_EXIT_CODE != 0:
        raise RenderToolchainError("the first attempt exited zero")
    if FIRST_ATTEMPT_HAD_TRACEBACK is not True:
        raise RenderToolchainError("and it printed a traceback")
    if FIRST_ATTEMPT_PRODUCED_PNG is not False:
        raise RenderToolchainError("and it produced nothing")
    if LATER_FAILURES_EXIT_CODE != 1:
        raise RenderToolchainError("later failures exit one")
    if EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH is not False:
        raise RenderToolchainError(
            "exit zero cannot be trusted on this path -- the trap must stay recorded"
        )
    if exit_code_is_reliable(True):
        raise RenderToolchainError("a traceback disqualifies the zero")
    if not exit_code_is_reliable(False):
        raise RenderToolchainError("a clean zero is fine")
    if PRESENCE_OF_PNG_IS_THE_JUDGE is not True:
        raise RenderToolchainError("the PNG's presence is the verdict")
    if not render_can_judge_by_output(True):
        raise RenderToolchainError("present png means done")

    if CLOSES_VISUAL_VERIFICATION_GAP is not True:
        raise RenderToolchainError("this closes the visual gap")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
