import type { UpdateInfo } from "../../util/update-check.js";
import type { LocalServerStatus } from "../../bootstrap.js";

export interface AppProps {
  initialProvider: string;
  initialModel: string;
  initialTheme: string;
  workdir: string;
  system?: string;
  undercover?: boolean;
  updatePromise?: Promise<UpdateInfo | null>;
  localServer?: LocalServerStatus;
}
