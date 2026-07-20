export type FocusLayer =
  | "permission"
  | "question"
  | "picker"
  | "prompt"
  | "keyboardShortcuts"
  | "subagent"
  | "historySearch"
  | "quickSearch"
  | "commandPalette"
  | "settings"
  | "designWizard"
  | "editing"
  | "plan"
  | "expanded"
  | "btw"
  | "taskPanel"
  | "attach"
  | "streaming"
  | "ready";

export interface FocusState {
  permission: boolean;
  question: boolean;
  picker: boolean;
  prompt: boolean;
  keyboardShortcuts: boolean;
  subagent: boolean;
  historySearch: boolean;
  quickSearch: boolean;
  commandPalette: boolean;
  settings: boolean;
  designWizard: boolean;
  editing: boolean;
  plan: boolean;
  expanded: boolean;
  btw: boolean;
  taskPanel: boolean;
  attach: boolean;
  streaming: boolean;
}
