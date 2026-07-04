# SWE-bench Preparation

SWE-bench evaluates whether an agent can turn a real issue into a patch that passes the benchmark tests.

This directory prepares Aurict for prediction generation. It does not include SWE-bench data and does not claim a score.

## Expected future flow

1. Use the official SWE-bench harness to prepare an instance repository.
2. Run `aurict_prediction_runner.py` against that prepared repository.
3. The script writes a SWE-bench-compatible JSONL prediction containing `instance_id`, `model_name_or_path`, and `model_patch`.
4. Submit that JSONL to the official SWE-bench evaluator.

## Command template

The runner delegates actual editing to `AURICT_SWEBENCH_COMMAND`.

```bash
export AURICT_SWEBENCH_COMMAND='aurict run-agent --workdir {repo_dir} --instruction-file {prompt_file} --yes --max-steps 80 --json {result_file}'

python3 evals/swe_bench/aurict_prediction_runner.py \
  --instance-json /path/to/instance.json \
  --repo-dir /path/to/prepared/repo \
  --out /tmp/aurict-swe-predictions.jsonl
```

## Template variables

- `{repo_dir}` prepared repository path
- `{prompt_file}` generated prompt file
- `{result_file}` optional Aurict telemetry output path
- `{instance_id}` SWE-bench instance id

## Required instance fields

The runner accepts normal SWE-bench-style JSON and uses these fields when present:

- `instance_id`
- `repo`
- `base_commit`
- `problem_statement`
- `hints_text`
- `FAIL_TO_PASS`
- `PASS_TO_PASS`

Missing optional fields are tolerated. Missing `instance_id` or `problem_statement` is treated as an error.
