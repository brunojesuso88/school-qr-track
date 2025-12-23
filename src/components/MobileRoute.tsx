import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface MobileRouteProps {
  children: React.ReactNode;
}

const MobileRoute = ({ children }: MobileRouteProps) => {
  const { user, loading, isMobileUser, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/mobile" replace />;
  }

  // Admins can also access mobile routes
  if (!isMobileUser && !isAdmin) {
    return <Navigate to="/auth/mobile" replace />;
  }

  return <>{children}</>;
};

export default MobileRoute;
