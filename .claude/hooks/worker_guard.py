#!/usr/bin/env python3
"""PreToolUse guard for the worker agents (scout, builder, engineer, reviewer).

Wired from each worker's frontmatter `hooks:` block, so it runs only while that
worker is active and never for the main session.

Blocks (exit 2, reason on stderr):
  Bash  - git acts that change history or branches (commit, push, merge, rebase,
          reset, checkout, switch, worktree, tag, cherry-pick, revert, am, stash),
          gh, ssh/scp/sftp/rsync, docker, psql, deploy scripts, migrations,
          and any reference to secret files.
  Read / Edit / Write / Grep / Glob - paths to secret files.

Secret files: .env and .env.* (except .env.example and *.template), .ssh/,
*.pem, *.key, id_rsa / id_ed25519.

Limits: this matches command text. A determined workaround (for example code
that assembles a command at runtime) can still get past it. It raises the
floor; it is not a sandbox. Any error in this script blocks the call.
"""
import json
import re
import sys

SECRET_PATH = re.compile(
    r"(^|[\s/'\"=:(])"
    r"(\.env(?!\.example\b)(?![\w.-]*\.template\b)(\.[\w.-]+)?"
    r"|\.ssh/|id_rsa|id_ed25519|[\w.-]+\.pem\b|[\w.-]+\.key\b)"
)

GIT_ACT = re.compile(
    r"\bgit\b(\s+-[cC]\s+\S+)*\s+"
    r"(commit|push|merge|rebase|reset|checkout|switch|worktree|tag|"
    r"cherry-pick|revert|am|stash)\b"
)

BASH_BLOCKS = [
    (GIT_ACT, "git act that changes history or branches"),
    (re.compile(r"(^|[\s;&|(`'\"])gh(\s|$)"), "GitHub CLI"),
    (re.compile(r"(^|[\s;&|(`'\"/])(ssh|scp|sftp|rsync)(\s|$)"), "remote host access"),
    (re.compile(r"(^|[\s;&|(`'\"/])docker(\s|$)|docker-compose"), "docker"),
    (re.compile(r"(^|[\s;&|(`'\"/])psql(\s|$)"), "direct database access"),
    (re.compile(r"deploy-production\.sh|pre-deploy-gate\.sh|deploy-lock\.sh|deploy-tag\.sh"), "deploy script"),
    (re.compile(r"\b(npm|pnpm|yarn|npx)\s+(run\s+)?[\w:-]*migrat"), "database migration"),
    (SECRET_PATH, "secret file"),
]

FILE_TOOLS = {"Read", "Edit", "Write", "Grep", "Glob", "NotebookEdit"}


def block(reason: str) -> None:
    sys.stderr.write(
        f"worker-guard: blocked ({reason}). Workers may not do this. "
        "Report it to the orchestrator instead.\n"
    )
    sys.exit(2)


def main() -> None:
    data = json.load(sys.stdin)
    tool = data.get("tool_name", "")
    ti = data.get("tool_input") or {}

    if tool == "Bash":
        cmd = str(ti.get("command", ""))
        for pattern, reason in BASH_BLOCKS:
            if pattern.search(cmd):
                block(reason)
    elif tool in FILE_TOOLS:
        for key in ("file_path", "path", "pattern", "notebook_path", "glob"):
            val = ti.get(key)
            if isinstance(val, str) and SECRET_PATH.search(" " + val):
                block("secret file")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # fail closed
        block(f"guard error: {type(exc).__name__}")
