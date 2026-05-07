import { Field } from "@base-ui/react/field";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps<T extends string> = {
  description?: string;
  error?: string;
  label: string;
  name?: string;
  onChange: (value: string) => void;
  options: Array<{ value: T | string; label: string }>;
  value: T | string;
};

type InlineSelectProps<T extends string> = {
  onChange: (value: string) => void;
  options: Array<{ value: T | string; label: string }>;
  value: T | string;
};

function normalizeOptions<T extends string>(options: Array<{ value: T | string; label: string }>) {
  return options.map((option) => ({ value: String(option.value), label: option.label }));
}

function SelectField<T extends string>({ description, error, label, name, options, onChange, value }: SelectFieldProps<T>) {
  const normalizedOptions = normalizeOptions(options);
  return (
    <Field.Root className="Field" invalid={!!error} name={name}>
      <Field.Label className="Field-label" nativeLabel={false} render={<div />}>
        {label}
      </Field.Label>
      {description ? <Field.Description className="Field-description">{description}</Field.Description> : null}
      <BaseSelect value={String(value)} options={normalizedOptions} onChange={onChange} triggerClassName="SelectTrigger" />
      <Field.Error className="Field-error" match={!!error}>
        {error}
      </Field.Error>
    </Field.Root>
  );
}

function InlineSelect<T extends string>({ value, options, onChange }: InlineSelectProps<T>) {
  return <BaseSelect value={String(value)} options={normalizeOptions(options)} onChange={onChange} triggerClassName="SelectTrigger SelectTrigger--inline" />;
}

function BaseSelect({
  value,
  options,
  onChange,
  triggerClassName
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  triggerClassName: string;
}) {
  const labels = new Map(options.map((option) => [option.value, option.label]));

  return (
    <Select.Root value={value} items={options} onValueChange={(nextValue) => onChange(String(nextValue ?? ""))}>
      <Select.Trigger className={triggerClassName}>
        <Select.Value className="SelectValue">{(selectedValue) => labels.get(String(selectedValue ?? "")) ?? ""}</Select.Value>
        <Select.Icon className="SelectIcon">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="SelectPositioner" sideOffset={4}>
          <Select.Popup className="SelectPopup">
            <Select.List className="SelectList">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} label={option.label} className="SelectItem">
                  <Select.ItemIndicator className="SelectItemIndicator">
                    <Check size={14} />
                  </Select.ItemIndicator>
                  <Select.ItemText className="SelectItemText">{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export { InlineSelect, SelectField };
