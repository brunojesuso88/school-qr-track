import { useNavigate } from "react-router-dom";
import { Users, BookOpen, GraduationCap, Grid3X3, FileText, Sun, Sunset, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SchoolMappingProvider, useSchoolMapping } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";

const SHIFT_CONFIG = {
  morning: { label: "Manhã", icon: Sun, color: "text-amber-500", hours: 30 },
  afternoon: { label: "Tarde", icon: Sunset, color: "text-orange-500", hours: 30 },
  evening: { label: "Noite", icon: Moon, color: "text-indigo-500", hours: 25 }
};

const SchoolMappingContent = () => {
  const navigate = useNavigate();
  const { teachers, globalSubjects, classes, classSubjects, loading } = useSchoolMapping();

  // Calculate hours by shift
  const calculateShiftStats = (shift: string) => {
    const shiftClasses = classes.filter(c => c.shift === shift);
    const expectedHours = SHIFT_CONFIG[shift as keyof typeof SHIFT_CONFIG]?.hours || 30;
    const totalExpected = shiftClasses.length * expectedHours;
    
    // Sum weekly_classes for class subjects with assigned teachers in this shift
    const filledHours = classSubjects
      .filter(cs => {
        const classData = classes.find(c => c.id === cs.class_id);
        return classData?.shift === shift && cs.teacher_id;
      })
      .reduce((acc, cs) => acc + cs.weekly_classes, 0);
    
    return { 
      classCount: shiftClasses.length,
      expected: totalExpected, 
      filled: filledHours,
      hoursPerClass: expectedHours
    };
  };

  const morningStats = calculateShiftStats('morning');
  const afternoonStats = calculateShiftStats('afternoon');
  const eveningStats = calculateShiftStats('evening');

  const assignedSubjects = classSubjects.filter(cs => cs.teacher_id).length;
  const totalClassSubjects = classSubjects.length;

  const menuOptions = [
    {
      title: "Professores",
      description: "Gerenciar professores e carga horária",
      icon: Users,
      path: "/school-mapping/teachers",
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/30",
      count: teachers.length
    },
    {
      title: "Disciplinas",
      description: "Gerenciar disciplinas globais",
      icon: BookOpen,
      path: "/school-mapping/subjects",
      gradient: "from-success/20 to-success/5",
      iconColor: "text-success",
      borderColor: "border-success/30",
      count: globalSubjects.length
    },
    {
      title: "Turmas",
      description: "Gerenciar turmas e suas disciplinas",
      icon: GraduationCap,
      path: "/school-mapping/classes",
      gradient: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/30",
      count: classes.length
    },
    {
      title: "Distribuição",
      description: "Atribuir professores às turmas",
      icon: Grid3X3,
      path: "/school-mapping/distribution",
      gradient: "from-purple-500/20 to-purple-500/5",
      iconColor: "text-purple-500",
      borderColor: "border-purple-500/30",
      count: assignedSubjects
    },
    {
      title: "Resumo",
      description: "Visão consolidada para direção",
      icon: FileText,
      path: "/school-mapping/summary",
      gradient: "from-cyan-500/20 to-cyan-500/5",
      iconColor: "text-cyan-500",
      borderColor: "border-cyan-500/30",
      count: null
    },
  ];

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </SchoolMappingLayout>
    );
  }

  const shiftCards = [
    { key: 'morning', stats: morningStats, ...SHIFT_CONFIG.morning },
    { key: 'afternoon', stats: afternoonStats, ...SHIFT_CONFIG.afternoon },
    { key: 'evening', stats: eveningStats, ...SHIFT_CONFIG.evening }
  ];

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mapeamento Escolar</h1>
          <p className="text-muted-foreground">Distribuição de professores e turmas</p>
        </div>

        {/* Shift Workload Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {shiftCards.map(({ key, label, icon: ShiftIcon, color, stats }) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShiftIcon className={`h-4 w-4 ${color}`} />
                  {label}
                  {stats.classCount > 0 && (
                    <span className="text-xs font-normal">
                      ({stats.classCount} turma{stats.classCount > 1 ? 's' : ''} × {stats.hoursPerClass}h)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{stats.filled}h</span>
                  <span className="text-muted-foreground">/ {stats.expected}h</span>
                </div>
                <Progress 
                  value={stats.expected > 0 ? (stats.filled / stats.expected) * 100 : 0} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Assigned Subjects Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disciplinas Atribuídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{assignedSubjects}</span>
              <span className="text-muted-foreground">/ {totalClassSubjects}</span>
            </div>
            <Progress 
              value={totalClassSubjects > 0 ? (assignedSubjects / totalClassSubjects) * 100 : 0} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        {/* Menu Options */}
        <div className="grid gap-4 md:grid-cols-2">
          {menuOptions.map((option) => (
            <Card
              key={option.path}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-2 ${option.borderColor} bg-gradient-to-r ${option.gradient}`}
              onClick={() => navigate(option.path)}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`p-4 rounded-xl bg-background/80 shadow-sm ${option.iconColor}`}>
                  <option.icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {option.title}
                    </h2>
                    {option.count !== null && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-background/60">
                        {option.count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <div className="text-muted-foreground/50">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SchoolMappingLayout>
  );
};

const SchoolMapping = () => {
  return (
    <SchoolMappingProvider>
      <SchoolMappingContent />
    </SchoolMappingProvider>
  );
};

export default SchoolMapping;
