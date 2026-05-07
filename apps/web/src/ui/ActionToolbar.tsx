import { Toolbar } from "@base-ui/react/toolbar";
import type { ReactNode } from "react";

function ActionToolbar({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <Toolbar.Root aria-label={label} className={["Toolbar", className].filter(Boolean).join(" ")}>
      {children}
    </Toolbar.Root>
  );
}

export { ActionToolbar };
