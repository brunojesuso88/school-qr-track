import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface WorkloadIndicatorProps {
  current: number;
  max: number;
  label?: string;
  showValues?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const WorkloadIndicator = ({ current, max, label, showValues = true, size = 'md' }: WorkloadIndicatorProps) => {
  const percentage = Math.min((current / max) * 100, 100);
  const isOverload = current > max;
  const isNearLimit = percentage >= 80 && !isOverload;

  const getColorClass = () => {
    if (isOverload) return 'text-destructive';
    if (isNearLimit) return 'text-warning';
    return 'text-success';
  };

  const getProgressColor = () => {
    if (isOverload) return 'bg-destructive';
    if (isNearLimit) return 'bg-warning';
    return 'bg-success';
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="space-y-1">
      <div className={cn("flex items-center justify-between", sizeClasses[size])}>
        {label && <span className="text-muted-foreground">{label}</span>}
        {showValues && (
          <span className={cn("font-medium", getColorClass())}>
            {current}/{max}h
          </span>
        )}
      </div>
      <div className={cn("w-full rounded-full bg-muted overflow-hidden", heightClasses[size])}>
        <div 
          className={cn("h-full rounded-full transition-all", getProgressColor())}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

export default WorkloadIndicator;
