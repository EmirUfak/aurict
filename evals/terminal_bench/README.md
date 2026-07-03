# Terminal-Bench Preparation

Terminal-Bench is the most relevant public benchmark track for Aurict because it evaluates agents inside real terminal environments.

This directory is only an integration scaffold. It does not claim a Terminal-Bench score yet.

## Expected future flow

1. Implement the headless CLI contract in [../benchmark-contract.md](../benchmark-contract.md).
2. Install Harbor and confirm the official oracle/smoke run works.
3. Run Aurict through the custom adapter in this directory.
4. Compare Aurict against public baselines using the same dataset, model class, task count, and timeout.

## Smoke command

Use the official Harbor/Terminal-Bench command for an environment smoke test first:

```bash
harbor run -d terminal-bench/terminal-bench-2 -a oracle -l 5
```

## Aurict adapter command

The adapter is intentionally environment-driven so it can work before the final CLI command name is settled.

```bash
export AURICT_TBENCH_INSTALL_COMMAND='npm install -g aurict'
export AURICT_TBENCH_RUN_COMMAND='aurict run-agent --workdir {workdir} --instruction-file {prompt_file} --yes --max-steps 80 --json {result_file}'

harbor run \
  -d terminal-bench/terminal-bench-2 \
  --agent evals.terminal_bench.aurict_agent:AurictAgent \
  -k 5
```

If running from a local checkout instead of npm, set `AURICT_TBENCH_INSTALL_COMMAND` to copy/build the local binary inside the benchmark container.

## Template variables

`AURICT_TBENCH_RUN_COMMAND` supports:

- `{instruction}` raw task instruction shell-quoted by the adapter
- `{prompt_file}` path to a task prompt file inside the environment
- `{workdir}` current task working directory
- `{result_file}` path where Aurict should write JSON telemetry

## Scoring notes

Terminal-Bench will judge task success through its own test harness. Aurict's JSON result should be treated as telemetry for cost, steps, tool calls, and runtime analysis.
