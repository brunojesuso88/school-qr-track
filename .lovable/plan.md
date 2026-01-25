
## Plano de Implementação: Melhorias no Sistema AEE

### Resumo das Alterações Solicitadas

1. **DashboardLayout**: Trocar "Sistema de Frequência / Gestão de Presença" por "Sistema de Gestão de Alunos"
2. **Sistema AEE - Modal Detalhado**: Ao clicar no card do aluno, exibir informações completas + lista de professores
3. **Laudo**: Adicionar opção de anexar/tirar foto do documento do laudo
4. **Laudo**: Adicionar campo "Sugestões de adaptações"
5. **Foto do Aluno**: Adicionar zoom ao clicar na foto (como na aba Alunos)
6. **Exportação PDF**: Botão para exportar relatório AEE do aluno

---

### Fase 1: Alterar Nome no DashboardLayout

**Arquivo**: `src/components/DashboardLayout.tsx`

Linhas 96-97 - Alterar:
```typescript
// DE:
<h1>Sistema de Frequência</h1>
<p>Gestão de Presença</p>

// PARA:
<h1>Sistema de Gestão de Alunos</h1>
<p>Gestão Escolar</p>
```

---

### Fase 2: Atualizar Banco de Dados

Adicionar novos campos à tabela `students` para:
- Anexo do documento do laudo (URL do arquivo)
- Sugestões de adaptações (texto livre)

```sql
ALTER TABLE public.students
ADD COLUMN aee_laudo_attachment_url TEXT,  -- URL do arquivo anexado
ADD COLUMN aee_adaptation_suggestions TEXT; -- Sugestões de adaptações
```

Criar bucket de storage para os documentos de laudo:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('aee-documents', 'aee-documents', false);

-- RLS para o bucket
CREATE POLICY "Admin/Direction/Teachers can upload AEE documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin', 'direction', 'teacher'])
);

CREATE POLICY "Staff can view AEE documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin', 'direction', 'teacher', 'staff'])
);

CREATE POLICY "Admin/Direction/Teachers can delete AEE documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin', 'direction', 'teacher'])
);
```

---

### Fase 3: Expandir Modal do AEE com Informações Completas

**Arquivo**: `src/pages/AEE.tsx`

Reorganizar para que ao clicar no card, o modal exiba:

**Aba 1 - Informações do Aluno:**
- Foto grande (clicável para zoom)
- Nome, ID, Turma, Turno, Idade
- Status (Ativo/Inativo)

**Aba 2 - Professores:**
- Lista dos professores do aluno baseado na turma
- Buscar em `mapping_classes` → `mapping_class_subjects` com o `class` do aluno
- Exibir: Nome do Professor | Disciplina

**Aba 3 - Informações do Laudo:**
- Campos existentes (CID, medicação, alfabetização, atividades adaptadas)
- Novo campo: Sugestões de adaptações (textarea)
- Novo: Upload/Tirar foto do documento do laudo

---

### Fase 4: Implementar Seção de Professores

Lógica para buscar professores do aluno:
1. Pegar o `class` do aluno (ex: "MM100")
2. Buscar `mapping_classes` onde `name` = classe do aluno
3. Buscar `mapping_class_subjects` onde `class_id` = id da turma
4. Para cada `class_subject`, buscar o professor em `mapping_teachers`

```typescript
// Buscar professores do aluno
const fetchStudentTeachers = async (studentClass: string) => {
  // 1. Buscar mapping_class pelo nome
  const { data: mappingClass } = await supabase
    .from('mapping_classes')
    .select('id')
    .eq('name', studentClass)
    .maybeSingle();
  
  if (!mappingClass) return [];
  
  // 2. Buscar disciplinas e professores
  const { data: classSubjects } = await supabase
    .from('mapping_class_subjects')
    .select(`
      subject_name,
      teacher_id,
      mapping_teachers (
        id,
        name,
        color
      )
    `)
    .eq('class_id', mappingClass.id)
    .not('teacher_id', 'is', null);
  
  return classSubjects;
};
```

**Exibição:**
```
┌─────────────────────────────────────────────────┐
│ Professores da Turma MM100                      │
├─────────────────────────────────────────────────┤
│ 🔵 Ana Luísa         │ Educação Digital        │
│ 🟢 Antônio Castro    │ Filosofia, Eletiva Base │
│ 🟡 Camila Renata     │ Biologia                │
│ ...                                              │
└─────────────────────────────────────────────────┘
```

---

### Fase 5: Implementar Upload/Foto do Laudo

Componente de upload similar ao de foto do aluno:
- Botão "Anexar Documento" que abre file picker (aceita PDF, JPG, PNG)
- Botão "Tirar Foto" que usa a câmera (em dispositivos móveis)
- Preview do documento anexado
- Armazenar no bucket `aee-documents`
- Salvar URL em `aee_laudo_attachment_url`

```typescript
// Upload do documento
const uploadLaudoDocument = async (file: File, studentId: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${studentId}-laudo-${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('aee-documents')
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;
  
  // Atualizar URL no estudante
  await supabase.from('students').update({
    aee_laudo_attachment_url: fileName
  }).eq('id', studentId);
};
```

---

### Fase 6: Implementar Zoom na Foto do Aluno

Reutilizar o padrão da página de Alunos:
- Adicionar estado `zoomPhotoStudent`
- Ao clicar na foto, abrir modal com `StudentPhoto` size="xl"
- Exibir nome e status do aluno

```typescript
// Estado
const [zoomPhotoStudent, setZoomPhotoStudent] = useState<Student | null>(null);

// No StudentPhoto do card
<StudentPhoto
  photoUrl={student.photo_url}
  fullName={student.full_name}
  status={student.status}
  size="md"
  onClick={() => setZoomPhotoStudent(student)}  // <- Adicionar onClick
/>

// Modal de zoom
<Dialog open={!!zoomPhotoStudent} onOpenChange={() => setZoomPhotoStudent(null)}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>{zoomPhotoStudent?.full_name}</DialogTitle>
      <DialogDescription>{zoomPhotoStudent?.student_id}</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col items-center gap-4 py-4">
      <StudentPhoto
        photoUrl={zoomPhotoStudent.photo_url}
        fullName={zoomPhotoStudent.full_name}
        status={zoomPhotoStudent.status}
        size="xl"
        className="border-4"
      />
    </div>
  </DialogContent>
</Dialog>
```

---

### Fase 7: Exportação PDF do Relatório AEE

Adicionar botão no card do aluno que gera PDF com:
- Dados pessoais (nome, turma, idade, foto)
- Informações do CID
- Medicação
- Status de alfabetização
- Atividades adaptadas
- Sugestões de adaptações
- Lista de professores
- Data do relatório

```typescript
const exportAEEReport = (student: Student, teachers: TeacherInfo[]) => {
  const printWindow = window.open('', '_blank');
  const html = `
    <html>
    <head>
      <title>Relatório AEE - ${student.full_name}</title>
      <style>
        body { font-family: Arial; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .section h3 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório AEE</h1>
        <h2>${student.full_name}</h2>
        <p>Turma: ${student.class} | Turno: ${getShiftLabel(student.shift)}</p>
      </div>
      
      <div class="section">
        <h3>Informações do Laudo</h3>
        <p><strong>Idade:</strong> ${calculateAge(student.birth_date)} anos</p>
        <p><strong>CID:</strong> ${student.aee_cid_code || 'Não informado'} - ${student.aee_cid_description || ''}</p>
        <p><strong>Medicação:</strong> ${student.aee_uses_medication ? 'Sim - ' + student.aee_medication_name : 'Não'}</p>
        <p><strong>Alfabetizado:</strong> ${getLiteracyLabel(student.aee_literacy_status)}</p>
        <p><strong>Atividades Adaptadas:</strong> ${student.aee_adapted_activities ? 'Sim' : 'Não'}</p>
      </div>
      
      <div class="section">
        <h3>Sugestões de Adaptações</h3>
        <p>${student.aee_adaptation_suggestions || 'Nenhuma sugestão registrada'}</p>
      </div>
      
      <div class="section">
        <h3>Professores</h3>
        <table>
          <tr><th>Professor</th><th>Disciplina</th></tr>
          ${teachers.map(t => `<tr><td>${t.name}</td><td>${t.subject}</td></tr>`).join('')}
        </table>
      </div>
      
      <p class="footer">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};
```

---

### Resumo de Arquivos a Alterar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/components/DashboardLayout.tsx` | Editar | Trocar título do sidebar |
| `supabase/migrations/xxx.sql` | Criar | Novos campos + bucket storage |
| `src/pages/AEE.tsx` | Editar | Modal expandido com abas, zoom foto, professores, PDF |

---

### Estrutura do Modal Expandido

```text
┌───────────────────────────────────────────────────────────────────┐
│ [X] Fechar                                                        │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │  [Foto]  Nome do Aluno                                      │   │
│ │          ID: XXX | Turma: MM100 | Manhã | 11 anos           │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│ │ Professores│ │ Info. Laudo  │ │ Exportar PDF │                  │
│ └────────────┘ └──────────────┘ └──────────────┘                  │
│                                                                   │
│ ═══════════════════════════════════════════════════════════════   │
│                                                                   │
│ [Aba Professores]                                                 │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ 🔵 Ana Luísa          Educação Digital                      │   │
│ │ 🟢 Antônio Castro     Filosofia, Eletiva de Base            │   │
│ │ 🟡 Camila Renata      Biologia                              │   │
│ │ 🔴 Carlos Eduardo     Educação Física                       │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ [Aba Informações do Laudo]                                        │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ CID: [código] [descrição]                                   │   │
│ │ Medicação: ( ) Não  (•) Sim → [Ritalina]                    │   │
│ │ Alfabetizado: ( ) Não  (•) Sim  ( ) Em processo             │   │
│ │ Atividades Adaptadas: ( ) Não  (•) Sim                      │   │
│ │                                                             │   │
│ │ Sugestões de Adaptações:                                    │   │
│ │ ┌───────────────────────────────────────────────────────┐   │   │
│ │ │ Texto livre para sugestões de adaptação...           │   │   │
│ │ └───────────────────────────────────────────────────────┘   │   │
│ │                                                             │   │
│ │ Documento do Laudo:                                         │   │
│ │ [📷 Tirar Foto] [📎 Anexar Arquivo]                         │   │
│ │ [Preview do documento se existir]                           │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│                                        [Cancelar] [Salvar]        │
└───────────────────────────────────────────────────────────────────┘
```

---

### Considerações Técnicas

1. **Busca de Professores**: Relacionamento indireto via `students.class` → `mapping_classes.name` → `mapping_class_subjects` → `mapping_teachers`
2. **Storage**: Novo bucket `aee-documents` com RLS adequado
3. **Campos novos**: `aee_laudo_attachment_url` e `aee_adaptation_suggestions`
4. **Componente de câmera**: Reutilizar lógica de captura de foto já existente no sistema
5. **PDF**: Usar `window.print()` para exportação simples e compatível
