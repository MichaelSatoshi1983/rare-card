import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";
import { AppButton } from "./AppButton";

function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delay={450} closeDelay={80}>
      {children}
    </Tooltip.Provider>
  );
}

function TooltipIconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <AppButton variant="icon" aria-label={label} onClick={onClick}>
            {children}
          </AppButton>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="TooltipPopup">{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export { TooltipIconButton, TooltipProvider };
