import { Form } from "@base-ui/react/form";
import type { FormEvent, ReactNode } from "react";

function StepForm({ children, onSubmit }: { children: ReactNode; onSubmit: () => void | Promise<void> }) {
  return (
    <Form
      className="StepForm"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
      }}
      onFormSubmit={() => {
        void onSubmit();
      }}
    >
      {children}
    </Form>
  );
}

export { StepForm };
