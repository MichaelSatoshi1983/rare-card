import { Progress } from "@base-ui/react/progress";

type ProgressBarProps = {
  label: string;
  value: number;
};

function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <Progress.Root value={value} className="Progress" aria-label={label}>
      <Progress.Track className="Progress-track">
        <Progress.Indicator className="Progress-indicator" style={{ width: `${value}%` }} />
      </Progress.Track>
    </Progress.Root>
  );
}

export { ProgressBar };
