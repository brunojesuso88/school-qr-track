import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import UpdatePrompt from "./components/UpdatePrompt";
import SplashScreen from "./pages/SplashScreen";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Classes from "./pages/Classes";
import QRCodes from "./pages/QRCodes";
import StaffScanQR from "./pages/StaffScanQR";
import Attendance from "./pages/Attendance";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import InstallPWA from "./pages/InstallPWA";
import NotFound from "./pages/NotFound";
import AEE from "./pages/AEE";
import Events from "./pages/Events";
import SchoolEvents from "./pages/SchoolEvents";
import Declarations from "./pages/Declarations";
import Teachers from "./pages/Teachers";
import Subjects from "./pages/Subjects";
import TeacherNotifications from "./pages/TeacherNotifications";
import IRA from "./pages/IRA";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <UpdatePrompt />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<SplashScreen />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/install" element={<InstallPWA />} />

              {/* Compatibilidade: antiga Home virou redirect para a Gestão */}
              <Route path="/home" element={<Navigate to="/dashboard" replace />} />

              {/* Admin Routes (Web) - Admin, Direção, Professor */}
              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/students" element={<AdminRoute><Students /></AdminRoute>} />
              <Route path="/aee" element={<AdminRoute><AEE /></AdminRoute>} />
              <Route path="/classes" element={<AdminRoute><Classes /></AdminRoute>} />
              <Route path="/teachers" element={<AdminRoute><Teachers /></AdminRoute>} />
              <Route path="/subjects" element={<AdminRoute><Subjects /></AdminRoute>} />
              <Route path="/ira" element={<AdminRoute><IRA /></AdminRoute>} />
              <Route path="/settings/ira" element={<Navigate to="/ira" replace />} />
              <Route path="/scan" element={<AdminRoute><QRCodes /></AdminRoute>} />
              <Route path="/attendance" element={<AdminRoute><Attendance /></AdminRoute>} />
              <Route path="/events" element={<AdminRoute><Events /></AdminRoute>} />
              <Route path="/school-events" element={<AdminRoute><SchoolEvents /></AdminRoute>} />
              <Route path="/declarations" element={<AdminRoute><Declarations /></AdminRoute>} />
              <Route path="/teacher-notifications" element={<AdminRoute><TeacherNotifications /></AdminRoute>} />
              {/* Central de notificações: todos os perfis autenticados (inclui staff) */}
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
              
              {/* Compatibilidade: módulos removidos (Mapeamento Escolar / Criação do Horário) */}
              <Route path="/school-mapping/teachers" element={<Navigate to="/teachers" replace />} />
              <Route path="/school-mapping/subjects" element={<Navigate to="/subjects" replace />} />
              <Route path="/school-mapping/classes" element={<Navigate to="/classes" replace />} />
              <Route path="/school-mapping/distribution" element={<Navigate to="/dashboard" replace />} />
              <Route path="/school-mapping/summary" element={<Navigate to="/dashboard" replace />} />
              <Route path="/school-mapping" element={<Navigate to="/dashboard" replace />} />
              <Route path="/timetable/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/timetable" element={<Navigate to="/dashboard" replace />} />

              {/* Staff Route - Funcionário (página simplificada) */}
              <Route path="/staff/scan" element={<StaffRoute><StaffScanQR /></StaffRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;