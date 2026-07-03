"""Harbor/Terminal-Bench adapter scaffold for Aurict.

This file is intentionally small and environment-driven. The final Aurict CLI
headless command can change later without rewriting the benchmark adapter.
"""

from __future__ import annotations

import os
import shlex

from harbor.agents.installed.base import BaseInstalledAgent, with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


DEFAULT_INSTALL_COMMAND = "npm install -g aurict"
DEFAULT_RUN_COMMAND = (
    "aurict run-agent "
    "--workdir {workdir} "
    "--instruction-file {prompt_file} "
    "--yes "
    "--max-steps 80 "
    "--json {result_file}"
)


def _template(command: str, *, instruction: str, workdir: str) -> str:
    prompt_file = "/tmp/aurict-terminal-bench-prompt.txt"
    result_file = "/tmp/aurict-terminal-bench-result.json"
    return (
        command.replace("{instruction}", shlex.quote(instruction))
        .replace("{prompt_file}", shlex.quote(prompt_file))
        .replace("{workdir}", shlex.quote(workdir))
        .replace("{result_file}", shlex.quote(result_file))
    )


class AurictAgent(BaseInstalledAgent):
    """Custom Terminal-Bench agent that runs Aurict non-interactively."""

    async def install(self, environment: BaseEnvironment) -> None:
        install_command = os.environ.get("AURICT_TBENCH_INSTALL_COMMAND", DEFAULT_INSTALL_COMMAND)
        await self.exec_as_agent(environment, command=install_command)

    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        prompt_file = "/tmp/aurict-terminal-bench-prompt.txt"
        escaped_instruction = shlex.quote(instruction)
        await self.exec_as_agent(
            environment,
            command=f"printf %s {escaped_instruction} > {shlex.quote(prompt_file)}",
        )

        run_command = os.environ.get("AURICT_TBENCH_RUN_COMMAND", DEFAULT_RUN_COMMAND)
        workdir = getattr(context, "workdir", ".")
        await self.exec_as_agent(
            environment,
            command=_template(run_command, instruction=instruction, workdir=workdir),
        )
