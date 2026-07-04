# Aurict Benchmark Contract

This file defines the CLI behavior expected by the public benchmark adapters in this directory. The command does not need to exist yet; it is the contract the CLI should satisfy later.

## Required behavior

The benchmark command must be fully non-interactive:

```bash
aurict run-agent \
  --workdir /path/to/task/repo \
  --instruction-file /path/to/prompt.txt \
  --yes \
  --max-steps 80 \
  --json /path/to/aurict-result.json
```

Expected behavior:

- Read the task instruction from `--instruction-file`.
- Operate only inside `--workdir` unless the benchmark harness explicitly mounts external files.
- Avoid TUI prompts, spinners, alternate screen rendering, clipboard access, or interactive approval dialogs.
- Apply edits directly to the benchmark repository.
- Run tests/checks when the agent decides they are needed.
- Exit with `0` when the run completed, even if the task may still be wrong.
- Exit non-zero only for infrastructure failures such as missing API key, invalid flags, or unrecoverable runtime errors.
- Write a JSON result file when `--json` is provided.

## Result JSON

Minimum result shape:

```json
{
  "task_id": "example-task",
  "status": "completed",
  "duration_ms": 123456,
  "model": "provider/model",
  "provider": "provider",
  "steps": 12,
  "tool_calls": 34,
  "input_tokens": 10000,
  "output_tokens": 2000,
  "estimated_cost_usd": 0.12,
  "notes": []
}
```

Recommended `status` values:

- `completed`
- `timeout`
- `blocked`
- `infrastructure_error`

## Why this matters

Terminal-Bench and SWE-bench score final task outcomes, but Aurict also needs internal telemetry to prove its specific value:

- success rate
- cost per solved task
- runtime per solved task
- steps per solved task
- tool-call efficiency
- timeout rate
- patch size and regression rate

The adapters in this directory are written around this contract so the CLI can be connected later without redesigning the benchmark layout.
