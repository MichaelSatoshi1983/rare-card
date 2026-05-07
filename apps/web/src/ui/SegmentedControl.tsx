import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ReactNode } from "react";

type SegmentedControlProps<T extends string> = {
  ariaLabel?: string;
  icon?: ReactNode;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
};

function SegmentedControl<T extends string>({ ariaLabel, value, options, icon, onChange }: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      value={[value]}
      className="ToggleGroup"
      onValueChange={(nextValue) => {
        const selectedValue = nextValue[0];
        if (selectedValue) onChange(selectedValue as T);
      }}
    >
      {icon ? <span className="ToggleGroup-icon">{icon}</span> : null}
      {options.map((option) => (
        <Toggle key={option.value} className="ToggleGroup-item" type="button" value={option.value}>
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export { SegmentedControl };
