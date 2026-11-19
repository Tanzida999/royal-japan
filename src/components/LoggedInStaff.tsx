import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StaffScan } from "@/components/StaffScan";
import type { Me } from "@/lib/app";

/**
 * Shows who is recording this action. The logged-in user is used automatically;
 * only the owner or a manager may switch to another staff member's code
 * (e.g. when entering a paper sale later). The RPCs still re-verify the code.
 */
export function LoggedInStaff({ me, value, onChange, onVerified }: {
  me: Me | null | undefined;
  value: string;
  onChange: (code: string) => void;
  onVerified?: () => void;
}) {
  const [other, setOther] = useState(false);
  const canSwitch = me?.role === "owner" || Boolean(me?.manager);

  if (!me) return <p className="text-sm text-muted-foreground">Loading your account…</p>;

  if (!me.staff_code) {
    return (
      <p role="alert" className="text-sm font-semibold text-destructive">
        Your account has no staff code. Ask the owner to set one on the Staff page.
      </p>
    );
  }

  if (other && canSwitch) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <StaffScan value="" onChange={(c) => onChange(c)} camera errorText="Unknown staff code" onVerified={onVerified} />
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setOther(false); onChange(me.staff_code ?? ""); }}>
          Use my own account ({me.name})
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span>
        Staff: <strong>{me.name}</strong> <span className="font-mono text-muted-foreground">({value || me.staff_code})</span>
      </span>
      {canSwitch && (
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setOther(true); onChange(""); }}>
          Record for another staff
        </Button>
      )}
    </div>
  );
}
