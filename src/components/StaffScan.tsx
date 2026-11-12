import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CameraScan } from "@/components/CameraScan";

/** Staff scans their STF-xxx badge. Calls onChange with the verified code (or "" if invalid). */
export function StaffScan({ value, onChange, autoFocus, camera, errorText, onVerified }: {
  value: string;
  onChange: (code: string, name: string) => void;
  autoFocus?: boolean;
  camera?: boolean;
  errorText?: string;
  onVerified?: () => void;
}) {
  const [text, setText] = useState(value);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const verified = useRef("");

  async function verify(raw = text) {
    const c = raw.trim().toUpperCase();
    if (c && verified.current === c) return; // already verified
    verified.current = "";
    setName("");
    setErr("");
    onChange("", "");
    if (!c) return;
    const { data, error } = await supabase.rpc("check_staff_code", { _code: c });
    if (error || !data) return setErr(errorText ?? `Wrong staff code: ${c}`);
    verified.current = c;
    setName(data);
    setText(c);
    onChange(c, data);
    onVerified?.();
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="staff-code">Staff code (scan your badge)</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="staff-code"
          className="min-w-0 flex-1"
          value={text}
          placeholder="STF-001"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={Boolean(err)}
          onChange={(e) => {
            setText(e.target.value);
            setErr("");
            verified.current = "";
            if (name) {
              setName("");
              onChange("", "");
            }
          }}
          onBlur={() => void verify()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void verify();
            }
          }}
        />
        {camera && <CameraScan onScan={(c) => { setText(c.trim()); void verify(c); }} />}
      </div>
      {name && <p className="text-sm font-medium text-primary">✓ {name}</p>}
      {err && <p role="alert" className="text-sm font-semibold text-destructive">{err}</p>}
    </div>
  );
}
