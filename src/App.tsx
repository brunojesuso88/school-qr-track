import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
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
import ResetPassword from "./pages/ResetPassword";
import Join from "./pages/Join";
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
        <SchoolProvider>
        <PermissionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <UpdatePrompt />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<SplashScreen />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/install" element={<InstallPWA />} />
              <Route path="/join/:token" element={<Join />} />

              {/* Compatibilidade: antiga Home virou redirect para a Gestão */}
              <Route path="/home" element={<Navigate to="/dashboard" replace />} />

              {/* Admin Routes (Web) - Admin, Direção, Professor */}
              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/students" element={<AdminRoute permission="students.view"><Students /></AdminRoute>} />
              <Route path="/aee" element={<AdminRoute permission="aee.view"><AEE /></AdminRoute>} />
              <Route path="/classes" element={<AdminRoute permission="classes.view"><Classes /></AdminRoute>} />
              <Route path="/teachers" element={<AdminRoute permission="teachers.view"><Teachers /></AdminRoute>} />
              <Route path="/subjects" element={<AdminRoute permission="subjects.view"><Subjects /></AdminRoute>} />
              <Route path="/ira" element={<AdminRoute permission="ira.view"><IRA /></AdminRoute>} />
              <Route path="/settings/ira" element={<Navigate to="/ira" replace />} />
              <Route path="/scan" element={<AdminRoute><QRCodes /></AdminRoute>} />
              <Route path="/attendance" element={<AdminRoute permission="attendance.view"><Attendance /></AdminRoute>} />
              <Route path="/events" element={<AdminRoute permission="projects.view"><Events /></AdminRoute>} />
              <Route path="/school-events" element={<AdminRoute permission="events.view"><SchoolEvents /></AdminRoute>} />
              <Route path="/declarations" element={<AdminRoute permission="declarations.access"><Declarations /></AdminRoute>} />
              <Route path="/teacher-notifications" element={<AdminRoute permission="teacher_notifications.access"><TeacherNotifications /></AdminRoute>} />
              {/* Central de notificações: todos os perfis autenticados (inclui staff) */}
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
              
              {/* Compatibilidade: módulo removido (Mapeamento Escolar) */}
              <Route path="/school-mapping/teachers" element={<Navigate to="/teachers" replace />} />
              <Route path="/school-mapping/subjects" element={<Navigate to="/subjects" replace />} />
              <Route path="/school-mapping/classes" element={<Navigate to="/classes" replace />} />
              <Route path="/school-mapping/distribution" element={<Navigate to="/dashboard" replace />} />
              <Route path="/school-mapping/summary" element={<Navigate to="/dashboard" replace />} />
              <Route path="/school-mapping" element={<Navigate to="/dashboard" replace />} />

              {/* Staff Route - Funcionário (página simplificada) */}
              <Route path="/staff/scan" element={<StaffRoute><StaffScanQR /></StaffRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </PermissionsProvider>
        </SchoolProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;