import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Dropdown that also keeps a value not in the list (e.g. filled from an earlier phone). */
export function OptionSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select className="field" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

/** Colour dropdown with an "Other…" choice for colours not in the list. */
export function ColorSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [other, setOther] = useState(false);
  const custom = other || (value !== "" && !options.includes(value));
  return (
    <div className="flex gap-2">
      <select className="field min-w-0 flex-1" aria-label="Color" value={custom ? "__other" : value}
        onChange={(e) => { if (e.target.value === "__other") { setOther(true); onChange(""); } else { setOther(false); onChange(e.target.value); } }}>
        <option value="">Select color</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other">Other…</option>
      </select>
      {custom && <Input aria-label="Other color" className="min-w-0 flex-1" placeholder="Type color" value={value} maxLength={50} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

