import { Button } from "@base-ui/react/button";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "icon" | "option";

type AppButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  children: ReactNode;
  className?: string;
  focusableWhenDisabled?: boolean;
  variant?: ButtonVariant;
};

function AppButton({ type = "button", variant = "secondary", className = "", children, ...props }: AppButtonProps) {
  return (
    <Button type={type} className={["Button", `Button--${variant}`, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Button>
  );
}

export { AppButton };
