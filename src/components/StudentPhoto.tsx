import { useSignedPhotoUrl } from '@/hooks/useSignedPhotoUrl';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentPhotoProps {
  photoUrl: string | null;
  fullName: string;
  status?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
  xl: 'w-64 h-64',
};

const iconSizes = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-8 h-8',
  xl: 'w-24 h-24',
};

export const StudentPhoto = ({
  photoUrl,
  fullName,
  status = 'active',
  size = 'md',
  onClick,
  className,
}: StudentPhotoProps) => {
  const { signedUrl, loading } = useSignedPhotoUrl(photoUrl);
  const isActive = status === 'active';

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center overflow-hidden border-2',
        isActive ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10',
        sizeClasses[size],
        onClick && 'cursor-pointer transition-transform hover:scale-105',
        className
      )}
      onClick={onClick}
    >
      {loading ? (
        <div className={cn('bg-muted animate-pulse rounded-full', sizeClasses[size])} />
      ) : signedUrl ? (
        <img
          src={signedUrl}
          alt={fullName}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If image fails to load, hide it
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <User
          className={cn(
            iconSizes[size],
            isActive ? 'text-green-600' : 'text-red-600'
          )}
        />
      )}
    </div>
  );
};
