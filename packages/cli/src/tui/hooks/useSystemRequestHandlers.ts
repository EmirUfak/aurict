import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  PermissionGate,
  PermissionStore,
  questionService,
  readAttachmentFromPath,
  setDefault,
} from "@aurict/core";
import type {
  Attachment,
  PermissionRequest,
  PermissionResponse,
  QuestionAnswer,
  QuestionRequest,
} from "@aurict/core";
import type { PermissionPromptDecision } from "../PermissionPrompt.js";
import { permissionTranscriptFeedback } from "../permission-feedback.js";
import { PERMISSION_STORE_FILE } from "../app/app-environment.js";

interface Params {
  permission: PermissionRequest | null;
  question: QuestionRequest | null;
  abortControllerRef: MutableRefObject<AbortController | null>;
  setProviderState: Dispatch<SetStateAction<string>>;
  setModelState: Dispatch<SetStateAction<string>>;
  setInput: Dispatch<SetStateAction<string>>;
  setPermissionQueue: Dispatch<SetStateAction<PermissionRequest[]>>;
  setQuestion: Dispatch<SetStateAction<QuestionRequest | null>>;
  setAttachInput: Dispatch<SetStateAction<boolean>>;
  setAttachPath: Dispatch<SetStateAction<string>>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  addSystemMsg: (content: string) => void;
}

export function useSystemRequestHandlers(params: Params) {
  const setProvider = useCallback((provider: string, model: string) => {
    params.setProviderState(provider);
    params.setModelState(model);
    setDefault("provider", provider);
    setDefault("model", model);
    params.addSystemMsg(`Provider changed: ${provider} / ${model}`);
  }, [params.addSystemMsg]);

  const setModel = useCallback((model: string) => {
    params.setModelState(model);
    setDefault("model", model);
    params.addSystemMsg(`Model changed: ${model}`);
  }, [params.addSystemMsg]);

  const handlePermission = useCallback(
    (decision: PermissionPromptDecision) => {
      const permission = params.permission;
      if (!permission) return;
      const response: PermissionResponse | null =
        typeof decision === "string" ? null : decision;
      const action = typeof decision === "string" ? decision : decision.decision;

      if (action === "edit") {
        PermissionGate.respond(permission.id, "deny");
        params.setInput(permission.pattern);
        params.setPermissionQueue((queue) => queue.slice(1));
      } else if (action === "deny_abort") {
        PermissionGate.respond(permission.id, "deny");
        params.setPermissionQueue((queue) => queue.slice(1));
        params.abortControllerRef.current?.abort();
        params.abortControllerRef.current = null;
      } else {
        PermissionGate.respond(
          permission.id,
          response ?? (action === "allow_once" ? "allow_once" : action),
        );
        if (action === "allow") {
          PermissionStore.approve(permission.tool, permission.pattern);
          PermissionStore.savePersisted(PERMISSION_STORE_FILE);
        } else if (action === "allow_directory") {
          PermissionStore.approveDirectory(permission.tool, permission.pattern);
          PermissionStore.savePersisted(PERMISSION_STORE_FILE);
        }
        params.setPermissionQueue((queue) =>
          queue.filter((item) => item.id !== permission.id),
        );
      }

      const feedback = permissionTranscriptFeedback(action, permission.tool);
      if (feedback) params.addSystemMsg(feedback);
    },
    [params.permission, params.addSystemMsg],
  );

  const handleQuestionAnswer = useCallback((answers: QuestionAnswer[]) => {
    if (!params.question) return;
    questionService.answer(params.question.id, answers);
    params.setQuestion(null);
  }, [params.question]);

  const handleQuestionReject = useCallback(() => {
    if (!params.question) return;
    questionService.reject(params.question.id);
    params.setQuestion(null);
  }, [params.question]);

  const handleAttachSubmit = useCallback(async (filePath: string) => {
    const trimmed = filePath.trim();
    if (trimmed) {
      try {
        const attachment = await readAttachmentFromPath(trimmed);
        params.setAttachments((attachments) => [...attachments, attachment]);
        params.addSystemMsg(
          `📎 Attached: ${attachment.name} (${attachment.mimeType})`,
        );
      } catch (error) {
        params.addSystemMsg(
          `⚠ Attachment failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    params.setAttachInput(false);
    params.setAttachPath("");
  }, [params.addSystemMsg]);

  return {
    setProvider,
    setModel,
    handlePermission,
    handleQuestionAnswer,
    handleQuestionReject,
    handleAttachSubmit,
  };
}
