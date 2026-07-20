import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

interface Params {
  inputRef: MutableRefObject<string>;
  loadingRef: MutableRefObject<boolean>;
  setInput: Dispatch<SetStateAction<string>>;
  addSystemMsg: (content: string) => void;
}

const ENTER_ALT_SCREEN = "\x1b[?1049h\x1b[2J\x1b[H";
const EXIT_ALT_SCREEN = "\x1b[?1049l";

export function useExternalEditor(params: Params): () => void {
  return useCallback(() => {
    if (params.loadingRef.current) return;
    const editor = process.env["EDITOR"] ?? process.env["VISUAL"] ?? "vi";
    const temporaryPath = join(tmpdir(), `aurict-input-${Date.now()}.txt`);
    try {
      writeFileSync(temporaryPath, params.inputRef.current, "utf8");
      process.stdout.write(EXIT_ALT_SCREEN);
      const result = spawnSync(editor, [temporaryPath], { stdio: "inherit" });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`${editor} exited with status ${result.status ?? "unknown"}`);
      }
      const content = readFileSync(temporaryPath, "utf8").replace(/\n$/, "");
      params.setInput(content);
    } catch (error) {
      params.addSystemMsg(
        `⚠ External editor failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      process.stdout.write(ENTER_ALT_SCREEN);
      rmSync(temporaryPath, { force: true });
    }
  }, [params.addSystemMsg]);
}
