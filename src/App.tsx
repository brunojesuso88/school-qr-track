import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";
import UpdatePrompt from "./components/UpdatePrompt";
import SplashScreen from "./pages/SplashScreen";
import Home from "./pages/Home";
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
import Declarations from "./pages/Declarations";
import SchoolMapping from "./pages/SchoolMapping";
import MappingTeachers from "./pages/mapping/MappingTeachers";
import MappingSubjects from "./pages/mapping/MappingSubjects";
import MappingClasses from "./pages/mapping/MappingClasses";
import MappingDistribution from "./pages/mapping/MappingDistribution";
import MappingSummary from "./pages/mapping/MappingSummary";
import Timetable from "./pages/Timetable";
import TimetableSettings from "./pages/timetable/TimetableSettings";
import TimetableRules from "./pages/timetable/TimetableRules";
import TimetableGenerate from "./pages/timetable/TimetableGenerate";
import TimetableExport from "./pages/timetable/TimetableExport";

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

              {/* Admin Routes (Web) - Admin, Direção, Professor */}
              <Route path="/home" element={<AdminRoute><Home /></AdminRoute>} />
              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/students" element={<AdminRoute><Students /></AdminRoute>} />
              <Route path="/aee" element={<AdminRoute><AEE /></AdminRoute>} />
              <Route path="/classes" element={<AdminRoute><Classes /></AdminRoute>} />
              <Route path="/scan" element={<AdminRoute><QRCodes /></AdminRoute>} />
              <Route path="/attendance" element={<AdminRoute><Attendance /></AdminRoute>} />
              <Route path="/declarations" element={<AdminRoute><Declarations /></AdminRoute>} />
              <Route path="/notifications" element={<AdminRoute><Notifications /></AdminRoute>} />
              <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
              
              {/* School Mapping Routes */}
              <Route path="/school-mapping" element={<AdminRoute><SchoolMapping /></AdminRoute>} />
              <Route path="/school-mapping/teachers" element={<AdminRoute><MappingTeachers /></AdminRoute>} />
              <Route path="/school-mapping/subjects" element={<AdminRoute><MappingSubjects /></AdminRoute>} />
              <Route path="/school-mapping/classes" element={<AdminRoute><MappingClasses /></AdminRoute>} />
              <Route path="/school-mapping/distribution" element={<AdminRoute><MappingDistribution /></AdminRoute>} />
              <Route path="/school-mapping/summary" element={<AdminRoute><MappingSummary /></AdminRoute>} />
              
              {/* Timetable Routes */}
              <Route path="/timetable" element={<AdminRoute><Timetable /></AdminRoute>} />
              <Route path="/timetable/settings" element={<AdminRoute><TimetableSettings /></AdminRoute>} />
              <Route path="/timetable/rules" element={<AdminRoute><TimetableRules /></AdminRoute>} />
              <Route path="/timetable/generate" element={<AdminRoute><TimetableGenerate /></AdminRoute>} />
              <Route path="/timetable/export" element={<AdminRoute><TimetableExport /></AdminRoute>} />

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