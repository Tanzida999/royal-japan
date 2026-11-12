import { supabase } from "@/integrations/supabase/client";

/** Records a user event in the activity log; never blocks the action it describes. */
export function logEvent(action: "login" | "logout" | "receipt_reprinted" | "label_printed" | "password_changed", table: string, recordId: string, details: Record<string, unknown> = {}) {
  return supabase.rpc("log_event", { _action: action, _table: table, _record_id: recordId, _details: details as never }).then(() => undefined, () => undefined);
}

const REMEMBER_KEY = "msm-remember";
const ALIVE_KEY = "msm-alive";

/** "Remember me" off: sign out when the browser is reopened. */
export function setRemember(on: boolean) {
  localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
  sessionStorage.setItem(ALIVE_KEY, "1");
}
export function shouldEndSession() {
  return localStorage.getItem(REMEMBER_KEY) === "0" && sessionStorage.getItem(ALIVE_KEY) !== "1";
}
