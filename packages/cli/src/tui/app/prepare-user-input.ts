import { extractSymbolBody, readAttachmentFromPath } from "@aurict/core";
import type { Attachment } from "@aurict/core";

export interface PreparedUserInput {
  text: string;
  attachments: Attachment[];
  warnings: string[];
}

const FILE_REFERENCE = /@([\w./~-]+\.[a-zA-Z]{2,6})(?::(\w+))?/g;

function resolveReferencePath(workdir: string, rawPath: string): string {
  if (rawPath.startsWith("~")) {
    const home = process.env["HOME"];
    if (!home) throw new Error("HOME is not configured");
    return rawPath.replace("~", home);
  }
  return rawPath.startsWith("/") ? rawPath : `${workdir}/${rawPath}`;
}

export async function prepareUserInput(
  userInput: string,
  workdir: string,
): Promise<PreparedUserInput> {
  let text = userInput.trim();
  const matches = [...text.matchAll(FILE_REFERENCE)];
  const attachments: Attachment[] = [];
  const contextBlocks: string[] = [];
  const warnings: string[] = [];

  for (const match of matches) {
    const rawPath = match[1]!;
    const symbolName = match[2];
    try {
      const fullPath = resolveReferencePath(workdir, rawPath);
      if (!symbolName) {
        attachments.push(await readAttachmentFromPath(fullPath));
        continue;
      }

      const extracted = await extractSymbolBody(fullPath, symbolName);
      if (!extracted) {
        warnings.push(`@${rawPath}:${symbolName} bulunamadı; referans mesaja eklenmedi.`);
        continue;
      }
      const extension = rawPath.slice(rawPath.lastIndexOf(".") + 1);
      contextBlocks.push(
        `[Context: @${rawPath}:${symbolName} — lines ${extracted.startLine}-${extracted.endLine}]\n\`\`\`${extension}\n${extracted.code}\n\`\`\``,
      );
    } catch (error) {
      const reference = symbolName ? `@${rawPath}:${symbolName}` : `@${rawPath}`;
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${reference} yüklenemedi: ${message}`);
    }
  }

  if (matches.length > 0) {
    text = text.replace(FILE_REFERENCE, "").replace(/\s{2,}/g, " ").trim();
  }
  if (contextBlocks.length > 0) {
    text = contextBlocks.join("\n\n") + (text ? `\n\n${text}` : "");
  }

  return { text, attachments, warnings };
}
