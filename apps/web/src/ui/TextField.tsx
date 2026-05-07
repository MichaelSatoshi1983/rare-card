import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import type { ReactNode } from "react";

type TextFieldProps = {
  action?: ReactNode;
  description?: string;
  error?: string;
  label: string;
  name?: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
};

type InlineTextInputProps = {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

function TextField({ action, description, error, label, name, onChange, type = "text", value }: TextFieldProps) {
  return (
    <Field.Root className="Field" invalid={!!error} name={name}>
      <div className="Field-labelRow">
        <Field.Label className="Field-label">{label}</Field.Label>
        {action}
      </div>
      {description ? <Field.Description className="Field-description">{description}</Field.Description> : null}
      <Input className="Field-control" type={type} value={value} onValueChange={onChange} />
      <Field.Error className="Field-error" match={!!error}>
        {error}
      </Field.Error>
    </Field.Root>
  );
}

function TextAreaField({ action, description, error, label, name, onChange, value }: Omit<TextFieldProps, "type">) {
  return (
    <Field.Root className="Field" invalid={!!error} name={name}>
      <div className="Field-labelRow">
        <Field.Label className="Field-label">{label}</Field.Label>
        {action}
      </div>
      {description ? <Field.Description className="Field-description">{description}</Field.Description> : null}
      <Field.Control className="Field-control Field-control--textarea" render={<textarea rows={4} />} value={value} onValueChange={onChange} />
      <Field.Error className="Field-error" match={!!error}>
        {error}
      </Field.Error>
    </Field.Root>
  );
}

function InlineTextInput({ value, placeholder, onChange }: InlineTextInputProps) {
  return <Input className="InlineControl" value={value} placeholder={placeholder} onValueChange={onChange} />;
}

export { InlineTextInput, TextAreaField, TextField };
