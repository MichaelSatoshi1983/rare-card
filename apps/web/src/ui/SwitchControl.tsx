import { Switch } from "@base-ui/react/switch";
import type { ReactNode } from "react";

type SwitchControlProps = {
  checked: boolean;
  children: ReactNode;
  className?: string;
  onCheckedChange: (checked: boolean) => void;
};

function SwitchControl({ checked, onCheckedChange, children, className = "" }: SwitchControlProps) {
  return (
    <label className={["SwitchField", className].filter(Boolean).join(" ")}>
      <Switch.Root checked={checked} onCheckedChange={onCheckedChange} className="Switch">
        <Switch.Thumb className="Switch-thumb" />
      </Switch.Root>
      <span className="SwitchField-label">{children}</span>
    </label>
  );
}

export { SwitchControl };
