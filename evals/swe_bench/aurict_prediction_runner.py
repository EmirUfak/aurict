#!/usr/bin/env python3
"""Generate a SWE-bench prediction JSONL entry with Aurict.

The official SWE-bench harness owns dataset download, repository checkout, test
execution, and scoring. This script only prepares an instruction, delegates to a
non-interactive Aurict command, captures the resulting git diff, and writes the
prediction row expected by SWE-bench evaluators.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
from pathlib import Path
from typing import Any


DEFAULT_MODEL_NAME = "aurict"
DEFAULT_COMMAND = (
    "aurict run-agent "
    "--workdir {repo_dir} "
    "--instruction-file {prompt_file} "
    "--yes "
    "--max-steps 80 "
    "--json {result_file}"
)


def require_text(instance: dict[str, Any], key: str) -> str:
    value = instance.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"instance is missing required string field: {key}")
    return value


def optional_json(instance: dict[str, Any], key: str) -> str:
    value = instance.get(key)
    if value in (None, "", []):
        return "Not provided."
    return json.dumps(value, ensure_ascii=False, indent=2)


def build_prompt(instance: dict[str, Any]) -> str:
    instance_id = require_text(instance, "instance_id")
    problem = require_text(instance, "problem_statement")
    repo = instance.get("repo", "unknown")
    base_commit = instance.get("base_commit", "unknown")
    hints = instance.get("hints_text") or "No hints provided."

    return f"""You are running inside a SWE-bench task repository.

Task id: {instance_id}
Repository: {repo}
Base commit: {base_commit}

Problem statement:
{problem}

Hints:
{hints}

Expected failing-to-passing tests:
{optional_json(instance, "FAIL_TO_PASS")}

Expected passing-to-passing tests:
{optional_json(instance, "PASS_TO_PASS")}

Instructions:
- Modify the repository to solve the issue.
- Keep the patch focused.
- Run relevant tests when practical.
- Do not edit files outside this repository.
- Leave the final answer concise; the benchmark will score the git diff.
"""


def run(command: str, cwd: Path, timeout: int) -> None:
    result = subprocess.run(
        command,
        cwd=str(cwd),
        shell=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"command failed with exit code {result.returncode}\n{result.stdout}")


def git_diff(repo_dir: Path) -> str:
    result = subprocess.run(
        ["git", "diff", "--binary"],
        cwd=str(repo_dir),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git diff failed\n{result.stderr}")
    return result.stdout


def expand_command(template: str, *, repo_dir: Path, prompt_file: Path, result_file: Path, instance_id: str) -> str:
    return (
        template.replace("{repo_dir}", shlex.quote(str(repo_dir)))
        .replace("{prompt_file}", shlex.quote(str(prompt_file)))
        .replace("{result_file}", shlex.quote(str(result_file)))
        .replace("{instance_id}", shlex.quote(instance_id))
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instance-json", required=True, type=Path)
    parser.add_argument("--repo-dir", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--timeout", default=3600, type=int)
    args = parser.parse_args()

    instance = json.loads(args.instance_json.read_text(encoding="utf-8"))
    instance_id = require_text(instance, "instance_id")
    prompt = build_prompt(instance)

    args.repo_dir.mkdir(parents=True, exist_ok=True)
    prompt_file = args.repo_dir / ".aurict-swe-prompt.txt"
    result_file = args.repo_dir / ".aurict-swe-result.json"
    prompt_file.write_text(prompt, encoding="utf-8")

    command_template = os.environ.get("AURICT_SWEBENCH_COMMAND", DEFAULT_COMMAND)
    command = expand_command(
        command_template,
        repo_dir=args.repo_dir,
        prompt_file=prompt_file,
        result_file=result_file,
        instance_id=instance_id,
    )
    run(command, args.repo_dir, args.timeout)

    prediction = {
        "instance_id": instance_id,
        "model_name_or_path": os.environ.get("AURICT_SWEBENCH_MODEL_NAME", DEFAULT_MODEL_NAME),
        "model_patch": git_diff(args.repo_dir),
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(prediction, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
