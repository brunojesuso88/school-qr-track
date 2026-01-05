import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface StaffRouteProps {
  children: React.ReactNode;
}

const StaffRoute = ({ children }: StaffRouteProps) => {
  const { user, loading, isStaffOnly } = useAuth();

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
    return <Navigate to="/auth" replace />;
  }

  // Only staff users can access staff routes
  if (!isStaffOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default StaffRoute;
