import { useCallback, useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { PermissionGate } from "@aurict/core";
import type { PermissionRequest } from "@aurict/core";
import { RemoteEventTypes, type RemoteEvent } from "../../remote/event-codec.js";
import { CliRemoteRuntime, type CliRemoteStatus } from "../../remote/runtime.js";

interface RemoteControllerParams {
  handleSubmit: (prompt: string) => Promise<void>;
  remoteRuntimeRef: MutableRefObject<CliRemoteRuntime | null>;
  remoteBridgeRef: MutableRefObject<{ start: () => void; stop: () => void }>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  setRemoteStatus: Dispatch<SetStateAction<CliRemoteStatus | "off">>;
  setPermissionQueue: Dispatch<SetStateAction<PermissionRequest[]>>;
  addSystemMsg: (content: string) => void;
}

export function useRemoteController(params: RemoteControllerParams): void {
  const startRemoteSession = useCallback(async () => {
    if (params.remoteRuntimeRef.current) {
      params.addSystemMsg("Remote session already active. Use /remote stop first.");
      return;
    }
    params.addSystemMsg("🔗 Starting remote session…");
    try {
      const { WebRtcCliTransport } = await import("../../remote/webrtc-transport.js");
      const runtime = new CliRemoteRuntime({ transport: new WebRtcCliTransport() });
      params.remoteRuntimeRef.current = runtime;
      runtime.onStatusChange(params.setRemoteStatus);
      runtime.onEvent((event: RemoteEvent) => handleRemoteEvent(event, params));
      await runtime.start();
      params.addSystemMsg("✓ Remote connected — the phone can now control this session.");
    } catch (error) {
      params.remoteRuntimeRef.current = null;
      params.setRemoteStatus("off");
      const message = error instanceof Error ? error.message : String(error);
      params.addSystemMsg(`⚠ Remote session failed: ${message}`);
    }
  }, [params]);

  const stopRemoteSession = useCallback(() => {
    const runtime = params.remoteRuntimeRef.current;
    if (!runtime) {
      params.addSystemMsg("No active remote session.");
      return;
    }
    params.remoteRuntimeRef.current = null;
    params.setRemoteStatus("off");
    void runtime.close()
      .then(() => params.addSystemMsg("Remote session closed."))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        params.addSystemMsg(`⚠ Remote session kapatılırken hata oluştu: ${message}`);
      });
  }, [params]);

  useEffect(() => {
    params.remoteBridgeRef.current = {
      start: () => { void startRemoteSession(); },
      stop: stopRemoteSession,
    };
  }, [params.remoteBridgeRef, startRemoteSession, stopRemoteSession]);
}

function handleRemoteEvent(event: RemoteEvent, params: RemoteControllerParams): void {
  if (event.type === RemoteEventTypes.promptSubmit) {
    const prompt = typeof event.payload["prompt"] === "string"
      ? event.payload["prompt"]
      : "";
    if (prompt.trim()) void params.handleSubmit(prompt);
    return;
  }
  if (event.type === RemoteEventTypes.interrupt) {
    params.abortControllerRef.current?.abort();
    params.abortControllerRef.current = null;
    return;
  }
  if (event.type !== RemoteEventTypes.permissionResponse) return;
  const id = typeof event.payload["id"] === "string" ? event.payload["id"] : undefined;
  const decision = event.payload["decision"];
  if (!id || (decision !== "allow" && decision !== "deny" && decision !== "allow_once")) {
    params.addSystemMsg("⚠ Remote permission yanıtı geçersiz olduğu için uygulanmadı.");
    return;
  }
  PermissionGate.respond(id, decision);
  params.setPermissionQueue((queue) => queue.filter((request) => request.id !== id));
}
