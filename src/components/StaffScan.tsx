import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Staff scans their STF-xxx badge. Calls onChange with the verified code (or "" if invalid). */
export function StaffScan({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [text, setText] = useState(value);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function verify() {
    const c = text.trim().toUpperCase();
    setName("");
    setErr("");
    onChange("");
    if (!c) return;
    const { data, error } = await supabase.rpc("check_staff_code", { _code: c });
    if (error || !data) return setErr(`Wrong staff code: ${c}`);
    setName(data);
    setText(c);
    onChange(c);
  }

  return (
    <div className="space-y-1">
      <Label>Staff code (scan your badge)</Label>
      <Input
        value={text}
        placeholder="STF-001"
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          if (name) {
            setName("");
            onChange("");
          }
        }}
        onBlur={verify}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            verify();
          }
        }}
      />
      {name && <p className="text-sm font-medium text-primary">✓ {name}</p>}
      {err && <p className="text-sm font-semibold text-destructive">{err}</p>}
    </div>
  );
}
