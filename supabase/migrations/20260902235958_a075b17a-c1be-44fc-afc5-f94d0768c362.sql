-- Funções internas: não expor a visitantes
REVOKE ALL ON FUNCTION public.seed_school_permissions(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_school_permissions_trigger() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_school_permission(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_has_any_school_role(app_role[]) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_school_permissions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_school_permissions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_school_permission(uuid, app_role, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reset_school_permissions(uuid, app_role) FROM anon;
REVOKE ALL ON FUNCTION public.my_school_permissions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.my_manageable_schools() FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_school_auto_approve(uuid, boolean) FROM anon;

-- ================= ALUNOS =================
DROP POLICY IF EXISTS "Admin direction teachers view students" ON public.students;
CREATE POLICY "Equipe com permissao visualiza alunos" ON public.students
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'students.view'));

DROP POLICY IF EXISTS "Admin direction teachers can insert students" ON public.students;
CREATE POLICY "Equipe com permissao cadastra alunos" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'students.create'));

DROP POLICY IF EXISTS "Privileged roles can update students" ON public.students;
CREATE POLICY "Equipe com permissao edita alunos" ON public.students
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'students.edit'));

DROP POLICY IF EXISTS "Only admin and direction can delete students" ON public.students;
CREATE POLICY "Equipe com permissao exclui alunos" ON public.students
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'students.delete'));

-- ================= OCORRÊNCIAS =================
DROP POLICY IF EXISTS "Admin direction and teachers can view occurrences" ON public.occurrences;
CREATE POLICY "Equipe com permissao visualiza ocorrencias" ON public.occurrences
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'occurrences.view'));

DROP POLICY IF EXISTS "Staff can insert occurrences" ON public.occurrences;
CREATE POLICY "Equipe com permissao registra ocorrencias" ON public.occurrences
  FOR INSERT TO authenticated WITH CHECK (
    public.has_school_permission(school_id, 'occurrences.create')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update occurrences" ON public.occurrences;
CREATE POLICY "Equipe com permissao edita ocorrencias" ON public.occurrences
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'occurrences.edit'));

DROP POLICY IF EXISTS "Admin direction and teachers can delete occurrences" ON public.occurrences;
CREATE POLICY "Equipe com permissao exclui ocorrencias" ON public.occurrences
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'occurrences.delete'));

-- ================= TURMAS =================
DROP POLICY IF EXISTS "Staff can view classes" ON public.classes;
CREATE POLICY "Equipe com permissao visualiza turmas" ON public.classes
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'classes.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin direction teachers can insert classes" ON public.classes;
CREATE POLICY "Equipe com permissao cria turmas" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'classes.create'));

DROP POLICY IF EXISTS "Admin direction teachers can update classes" ON public.classes;
CREATE POLICY "Equipe com permissao edita turmas" ON public.classes
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'classes.edit'));

DROP POLICY IF EXISTS "Only admin and direction can delete classes" ON public.classes;
CREATE POLICY "Equipe com permissao exclui turmas" ON public.classes
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'classes.delete'));

-- ================= FREQUÊNCIA =================
DROP POLICY IF EXISTS "Admin direction teachers view attendance" ON public.attendance;
CREATE POLICY "Equipe com permissao visualiza frequencia" ON public.attendance
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'attendance.view'));

DROP POLICY IF EXISTS "Staff can insert attendance" ON public.attendance;
CREATE POLICY "Equipe com permissao registra frequencia" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (
    public.has_school_permission(school_id, 'attendance.record')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
CREATE POLICY "Equipe com permissao atualiza frequencia" ON public.attendance
  FOR UPDATE TO authenticated USING (
    public.has_school_permission(school_id, 'attendance.edit')
    OR (public.has_row_role(school_id, ARRAY['staff']::app_role[]) AND date = CURRENT_DATE));

DROP POLICY IF EXISTS "Admin direction and teachers can delete attendance" ON public.attendance;
CREATE POLICY "Equipe com permissao exclui frequencia" ON public.attendance
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'attendance.delete'));

-- ================= NOTAS =================
DROP POLICY IF EXISTS "Equipe visualiza notas" ON public.student_grades;
CREATE POLICY "Equipe com permissao visualiza notas" ON public.student_grades
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'grades.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin e direcao gerenciam notas" ON public.student_grades;
CREATE POLICY "Equipe com permissao gerencia notas" ON public.student_grades
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'grades.manage'));
CREATE POLICY "Equipe com permissao atualiza notas" ON public.student_grades
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'grades.manage'));
CREATE POLICY "Equipe com permissao exclui notas" ON public.student_grades
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'grades.manage'));

DROP POLICY IF EXISTS "Equipe visualiza disciplinas do boletim" ON public.grade_subjects;
CREATE POLICY "Equipe com permissao visualiza disciplinas do boletim" ON public.grade_subjects
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'grades.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin e direcao gerenciam disciplinas do boletim" ON public.grade_subjects;
CREATE POLICY "Equipe com permissao gerencia disciplinas do boletim" ON public.grade_subjects
  FOR ALL TO authenticated
  USING (public.has_school_permission(school_id, 'grades.manage'))
  WITH CHECK (public.has_school_permission(school_id, 'grades.manage'));

DROP POLICY IF EXISTS "Equipe visualiza periodos do boletim" ON public.grade_periods;
CREATE POLICY "Equipe com permissao visualiza periodos do boletim" ON public.grade_periods
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'grades.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin e direcao gerenciam periodos do boletim" ON public.grade_periods;
CREATE POLICY "Equipe com permissao gerencia periodos do boletim" ON public.grade_periods
  FOR ALL TO authenticated
  USING (public.has_school_permission(school_id, 'grades.manage'))
  WITH CHECK (public.has_school_permission(school_id, 'grades.manage'));

-- ================= PROJETOS (school_events) =================
DROP POLICY IF EXISTS "Staff can view school_events" ON public.school_events;
CREATE POLICY "Equipe com permissao visualiza projetos" ON public.school_events
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'projects.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin direction teachers insert school_events" ON public.school_events;
CREATE POLICY "Equipe com permissao cria projetos" ON public.school_events
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'projects.create'));

DROP POLICY IF EXISTS "Admin direction teachers update school_events" ON public.school_events;
CREATE POLICY "Equipe com permissao edita projetos" ON public.school_events
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'projects.edit'));

DROP POLICY IF EXISTS "Admin direction teachers delete school_events" ON public.school_events;
CREATE POLICY "Equipe com permissao exclui projetos" ON public.school_events
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'projects.delete'));

-- ================= EVENTOS (school_event_simple) =================
DROP POLICY IF EXISTS "Staff can view school_event_simple" ON public.school_event_simple;
CREATE POLICY "Equipe com permissao visualiza eventos" ON public.school_event_simple
  FOR SELECT TO authenticated USING (
    public.has_school_permission(school_id, 'events.view')
    OR public.has_row_role(school_id, ARRAY['staff']::app_role[]));

DROP POLICY IF EXISTS "Admin direction teachers insert school_event_simple" ON public.school_event_simple;
CREATE POLICY "Equipe com permissao cria eventos" ON public.school_event_simple
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'events.create'));

DROP POLICY IF EXISTS "Admin direction teachers update school_event_simple" ON public.school_event_simple;
CREATE POLICY "Equipe com permissao edita eventos" ON public.school_event_simple
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'events.edit'));

DROP POLICY IF EXISTS "Admin direction teachers delete school_event_simple" ON public.school_event_simple;
CREATE POLICY "Equipe com permissao exclui eventos" ON public.school_event_simple
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'events.delete'));

-- ================= AEE (delete segue restrito a admin/direção) =================
DROP POLICY IF EXISTS "Admin direction teachers view student_pei" ON public.student_pei;
CREATE POLICY "Equipe com permissao visualiza student_pei" ON public.student_pei
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'aee.view'));

DROP POLICY IF EXISTS "Admin direction teachers can insert student_pei" ON public.student_pei;
CREATE POLICY "Equipe com permissao insere student_pei" ON public.student_pei
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'aee.manage'));

DROP POLICY IF EXISTS "Admin direction teachers can update student_pei" ON public.student_pei;
CREATE POLICY "Equipe com permissao atualiza student_pei" ON public.student_pei
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'aee.manage'));

DROP POLICY IF EXISTS "Admin direction teachers view student_paee" ON public.student_paee;
CREATE POLICY "Equipe com permissao visualiza student_paee" ON public.student_paee
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'aee.view'));

DROP POLICY IF EXISTS "Admin direction teachers can insert student_paee" ON public.student_paee;
CREATE POLICY "Equipe com permissao insere student_paee" ON public.student_paee
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'aee.manage'));

DROP POLICY IF EXISTS "Admin direction teachers can update student_paee" ON public.student_paee;
CREATE POLICY "Equipe com permissao atualiza student_paee" ON public.student_paee
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'aee.manage'));

-- ================= PROFESSORES =================
DROP POLICY IF EXISTS "Admin and direction can select mapping_teachers" ON public.mapping_teachers;
CREATE POLICY "Equipe com permissao visualiza professores" ON public.mapping_teachers
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'teachers.view'));

DROP POLICY IF EXISTS "Admin and direction can insert mapping_teachers" ON public.mapping_teachers;
CREATE POLICY "Equipe com permissao insere professores" ON public.mapping_teachers
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'teachers.manage'));

DROP POLICY IF EXISTS "Admin and direction can update mapping_teachers" ON public.mapping_teachers;
CREATE POLICY "Equipe com permissao atualiza professores" ON public.mapping_teachers
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'teachers.manage'));

DROP POLICY IF EXISTS "Admin and direction can delete mapping_teachers" ON public.mapping_teachers;
CREATE POLICY "Equipe com permissao exclui professores" ON public.mapping_teachers
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'teachers.manage'));

-- ================= DISCIPLINAS (leitura permanece por escola) =================
DROP POLICY IF EXISTS "School management manages subjects catalog" ON public.mapping_global_subjects;
CREATE POLICY "Equipe com permissao gerencia catalogo de disciplinas" ON public.mapping_global_subjects
  FOR ALL TO authenticated
  USING (public.has_school_permission(school_id, 'subjects.manage'))
  WITH CHECK (public.has_school_permission(school_id, 'subjects.manage'));

DROP POLICY IF EXISTS "School management manages curriculum matrix" ON public.curriculum_matrix_subjects;
CREATE POLICY "Equipe com permissao gerencia matriz curricular" ON public.curriculum_matrix_subjects
  FOR ALL TO authenticated
  USING (public.has_school_permission(school_id, 'subjects.manage'))
  WITH CHECK (public.has_school_permission(school_id, 'subjects.manage'));

-- ================= IRA (leitura permanece para a equipe) =================
DROP POLICY IF EXISTS "Admin e direcao gerenciam configuracao do IRA" ON public.ira_settings;
CREATE POLICY "Equipe com permissao gerencia configuracao do IRA" ON public.ira_settings
  FOR ALL TO authenticated
  USING (public.has_school_permission(school_id, 'ira.configure'))
  WITH CHECK (public.has_school_permission(school_id, 'ira.configure'));

DROP POLICY IF EXISTS "Gestao pode gravar o IRA persistido" ON public.ira_snapshots;
CREATE POLICY "Equipe com permissao grava o IRA persistido" ON public.ira_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'ira.recalculate'));

DROP POLICY IF EXISTS "Gestao pode atualizar o IRA persistido" ON public.ira_snapshots;
CREATE POLICY "Equipe com permissao atualiza o IRA persistido" ON public.ira_snapshots
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'ira.recalculate'));

DROP POLICY IF EXISTS "Gestao pode limpar o IRA persistido" ON public.ira_snapshots;
CREATE POLICY "Equipe com permissao limpa o IRA persistido" ON public.ira_snapshots
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'ira.recalculate'));

-- ================= NOTIFICAÇÃO DOCENTE =================
DROP POLICY IF EXISTS "Admin direction can view teacher_notifications" ON public.teacher_notifications;
CREATE POLICY "Equipe com permissao visualiza teacher_notifications" ON public.teacher_notifications
  FOR SELECT TO authenticated USING (public.has_school_permission(school_id, 'teacher_notifications.access'));

DROP POLICY IF EXISTS "Admin direction can insert teacher_notifications" ON public.teacher_notifications;
CREATE POLICY "Equipe com permissao insere teacher_notifications" ON public.teacher_notifications
  FOR INSERT TO authenticated WITH CHECK (public.has_school_permission(school_id, 'teacher_notifications.manage'));

DROP POLICY IF EXISTS "Admin direction can update teacher_notifications" ON public.teacher_notifications;
CREATE POLICY "Equipe com permissao atualiza teacher_notifications" ON public.teacher_notifications
  FOR UPDATE TO authenticated USING (public.has_school_permission(school_id, 'teacher_notifications.manage'));

DROP POLICY IF EXISTS "Admin direction can delete teacher_notifications" ON public.teacher_notifications;
CREATE POLICY "Equipe com permissao exclui teacher_notifications" ON public.teacher_notifications
  FOR DELETE TO authenticated USING (public.has_school_permission(school_id, 'teacher_notifications.manage'));

-- ================= ATESTADOS (permissão só restringe) =================
DROP POLICY IF EXISTS "Admin and direction can insert certificates" ON public.student_medical_certificates;
CREATE POLICY "Admin and direction can insert certificates" ON public.student_medical_certificates
  FOR INSERT TO authenticated WITH CHECK (
    public.has_row_role(school_id, ARRAY['admin','direction']::app_role[])
    AND public.has_school_permission(school_id, 'medical_certificates.manage'));

DROP POLICY IF EXISTS "Teachers can insert certificates" ON public.student_medical_certificates;
CREATE POLICY "Teachers can insert certificates" ON public.student_medical_certificates
  FOR INSERT TO authenticated WITH CHECK (
    public.has_row_role(school_id, ARRAY['teacher']::app_role[])
    AND public.has_school_permission(school_id, 'medical_certificates.manage')
    AND created_by = auth.uid()
    AND status_manual = 'active'
    AND cancelled_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS NULL);

DROP POLICY IF EXISTS "Admin and direction can update certificates" ON public.student_medical_certificates;
CREATE POLICY "Admin and direction can update certificates" ON public.student_medical_certificates
  FOR UPDATE TO authenticated USING (
    public.has_row_role(school_id, ARRAY['admin','direction']::app_role[])
    AND public.has_school_permission(school_id, 'medical_certificates.manage'));