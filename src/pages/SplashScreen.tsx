import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import edunexusLogo from "@/assets/edunexus-logo.png";

const SplashScreen = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin, isMobileUser } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSplash && !loading) {
      if (user) {
        if (isAdmin) {
          navigate("/home");
        } else if (isMobileUser) {
          navigate("/mobile-home");
        } else {
          // Fallback: wait for role to load
          navigate("/home");
        }
      } else {
        navigate("/home");
      }
    }
  }, [showSplash, loading, user, isAdmin, isMobileUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="text-center animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <img
            src={edunexusLogo}
            alt="Edunexus Logo"
            className="relative w-64 h-64 object-contain mx-auto drop-shadow-2xl"
          />
        </div>
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
