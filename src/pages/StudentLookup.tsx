import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, User, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  guardian_name: string;
  guardian_phone: string;
  has_medical_report: boolean;
  medical_report_details: string | null;
  photo_url: string | null;
}

interface Attendance {
  id: string;
  date: string;
  time: string | null;
  status: string;
}

interface Occurrence {
  id: string;
  date: string;
  type: string;
  description: string | null;
}

const StudentLookup = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setStudent(null);
    setNotFound(false);

    try {
      // Search by name or student_id
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%`)
        .limit(1);

      if (error) throw error;

      if (!students || students.length === 0) {
        setNotFound(true);
        return;
      }

      const foundStudent = students[0] as Student;
      setStudent(foundStudent);

      // Fetch attendance (last 30 records)
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, date, time, status')
        .eq('student_id', foundStudent.id)
        .order('date', { ascending: false })
        .limit(30);

      setAttendance(attendanceData || []);

      // Fetch occurrences
      const { data: occurrencesData } = await supabase
        .from('occurrences')
        .select('id, date, type, description')
        .eq('student_id', foundStudent.id)
        .order('date', { ascending: false })
        .limit(20);

      setOccurrences(occurrencesData || []);

    } catch (error) {
      console.error('Error searching student:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success text-success-foreground">Presente</Badge>;
      case 'absent':
        return <Badge className="bg-destructive text-destructive-foreground">Ausente</Badge>;
      case 'justified':
        return <Badge className="bg-warning text-warning-foreground">Justificado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOccurrenceTypeBadge = (type: string) => {
    switch (type) {
      case 'disciplinar':
        return <Badge variant="destructive">Disciplinar</Badge>;
      case 'pedagogica':
        return <Badge className="bg-warning text-warning-foreground">Pedagógica</Badge>;
      case 'saude':
        return <Badge className="bg-primary text-primary-foreground">Saúde</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/mobile-home")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Consultar Aluno</h1>
            <p className="text-xs text-muted-foreground">
              Busque por nome ou matrícula
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Nome ou matrícula..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Not Found */}
        {notFound && (
          <Card className="text-center p-6">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum aluno encontrado</p>
          </Card>
        )}

        {/* Student Info */}
        {student && (
          <div className="space-y-4 animate-fade-in">
            {/* Student Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                    {student.photo_url ? (
                      <img 
                        src={student.photo_url} 
                        alt={student.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-foreground">{student.full_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {student.class} • {student.shift === 'morning' ? 'Manhã' : student.shift === 'afternoon' ? 'Tarde' : 'Noite'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Matrícula: {student.student_id}
                    </p>
                    {student.has_medical_report && (
                      <Badge variant="outline" className="mt-2 text-warning border-warning">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Laudo médico
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Guardian Info */}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Responsável</p>
                  <p className="font-medium">{student.guardian_name}</p>
                  <p className="text-sm text-muted-foreground">{student.guardian_phone}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Attendance and Occurrences */}
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="attendance">
                  <Calendar className="h-4 w-4 mr-2" />
                  Frequência
                </TabsTrigger>
                <TabsTrigger value="occurrences">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Ocorrências
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-4">
                {attendance.length === 0 ? (
                  <Card className="p-4 text-center">
                    <p className="text-muted-foreground text-sm">Nenhum registro encontrado</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {attendance.map((record) => (
                      <Card key={record.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {format(new Date(record.date), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            {record.time && (
                              <p className="text-xs text-muted-foreground">{record.time}</p>
                            )}
                          </div>
                          {getStatusBadge(record.status)}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="occurrences" className="mt-4">
                {occurrences.length === 0 ? (
                  <Card className="p-4 text-center">
                    <p className="text-muted-foreground text-sm">Nenhuma ocorrência registrada</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {occurrences.map((occurrence) => (
                      <Card key={occurrence.id} className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(occurrence.date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          {getOccurrenceTypeBadge(occurrence.type)}
                        </div>
                        {occurrence.description && (
                          <p className="text-sm text-foreground">{occurrence.description}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLookup;
