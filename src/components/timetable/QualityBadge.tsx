import { cn } from '@/lib/utils';
import { Star, AlertTriangle, XCircle } from 'lucide-react';

interface QualityBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const QualityBadge = ({ score, showLabel = true, size = 'md' }: QualityBadgeProps) => {
  const getQualityInfo = () => {
    if (score >= 80) {
      return {
        label: 'Excelente',
        icon: Star,
        className: 'bg-success/10 text-success border-success/30'
      };
    }
    if (score >= 50) {
      return {
        label: 'Ajustável',
        icon: AlertTriangle,
        className: 'bg-warning/10 text-warning border-warning/30'
      };
    }
    return {
      label: 'Inviável',
      icon: XCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/30'
    };
  };

  const info = getQualityInfo();
  const Icon = info.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full border font-medium",
      info.className,
      sizeClasses[size]
    )}>
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{info.label}</span>}
      <span className="font-bold">{score}%</span>
    </div>
  );
};

export default QualityBadge;
