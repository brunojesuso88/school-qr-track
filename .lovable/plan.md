
## Plano de Implementação: Sistema AEE e Melhorias

### Resumo das Alterações Solicitadas

1. **Tela Inicial**: Trocar "Sistema de gestão de presença" por "Sistema de gestão de alunos"
2. **Editar Aluno**: Remover campo "Especificação do Laudo"
3. **Nova Página**: Criar "Sistema AEE" no sidebar
4. **Sistema AEE**: Exibir alunos com laudo e formulário estruturado de informações

---

### Fase 1: Alteração na Tela Inicial

**Arquivo**: `src/pages/Home.tsx`

Alteração simples no título do menu:
- Linha 45: Trocar `"Sistema de gestão de presença"` por `"Sistema de gestão de alunos"`

---

### Fase 2: Remover "Especificação do Laudo" do Formulário de Edição

**Arquivo**: `src/pages/Students.tsx`

Remover o bloco de código das linhas 821-832 que exibe o campo `Textarea` para "Especificação do Laudo":

```typescript
// REMOVER este bloco:
{formData.has_medical_report && (
  <div className="space-y-2">
    <Label htmlFor="medical_report_details">Especificação do Laudo</Label>
    <Textarea
      id="medical_report_details"
      value={formData.medical_report_details}
      onChange={(e) => setFormData({ ...formData, medical_report_details: e.target.value })}
      placeholder="Descreva o tipo de laudo, condição ou necessidades especiais do aluno..."
      rows={3}
    />
  </div>
)}
```

O campo `has_medical_report` (Sim/Não) continuará existindo para marcar o aluno como tendo laudo.

---

### Fase 3: Atualizar Banco de Dados para Sistema AEE

Será necessário adicionar novos campos estruturados à tabela `students` para armazenar as informações do laudo AEE:

```sql
-- Novos campos para Sistema AEE
ALTER TABLE public.students
ADD COLUMN aee_cid_code TEXT,              -- Código CID
ADD COLUMN aee_cid_description TEXT,        -- Descrição do CID
ADD COLUMN aee_uses_medication BOOLEAN DEFAULT FALSE,  -- Usa medicação?
ADD COLUMN aee_medication_name TEXT,        -- Qual medicação?
ADD COLUMN aee_literacy_status TEXT DEFAULT 'no',  -- Alfabetizado: no, yes, in_process
ADD COLUMN aee_adapted_activities BOOLEAN DEFAULT FALSE;  -- Atividades adaptadas?

-- Adicionar constraint para literacy_status
ALTER TABLE public.students
ADD CONSTRAINT students_aee_literacy_status_check 
CHECK (aee_literacy_status IN ('no', 'yes', 'in_process'));
```

---

### Fase 4: Criar Página do Sistema AEE

#### 4.1 Novo Arquivo: `src/pages/AEE.tsx`

Criar nova página com as seguintes funcionalidades:

**Estrutura da página:**
- Layout similar ao `Students.tsx` usando `DashboardLayout`
- Header com título "Sistema AEE - Atendimento Educacional Especializado"
- Filtros por turma e turno (igual a Students)
- Grid de cards dos alunos com laudo
- Modal de "Informações do Laudo" ao clicar no card

**Card do Aluno (simplificado):**
- Foto do aluno
- Nome e ID
- Turma e Turno
- Badge "Laudo"
- **Único botão**: "Informações do Laudo"

**Modal "Informações do Laudo":**
Campos estruturados conforme solicitado:

```
┌─────────────────────────────────────────────────────────────┐
│            INFORMAÇÕES DO LAUDO - [Nome do Aluno]           │
├─────────────────────────────────────────────────────────────┤
│ Idade: [calculado automaticamente da data de nascimento]   │
│                                                              │
│ CID                                                          │
│ ├─ Código: [________________]                               │
│ └─ Descrição: [____________________________________]        │
│                                                              │
│ Faz uso de medicação:                                        │
│ ○ Não                                                        │
│ ○ Sim. Qual?: [________________]                            │
│                                                              │
│ É alfabetizado:                                              │
│ ○ Não                                                        │
│ ○ Sim                                                        │
│ ○ Em processo                                                │
│                                                              │
│ Atividades e provas adaptadas:                              │
│ ○ Não                                                        │
│ ○ Sim                                                        │
│                                                              │
│                              [Salvar]  [Cancelar]            │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 Lógica de Filtragem

A página AEE exibe **apenas** alunos onde `has_medical_report = true`:

```typescript
const aeeStudents = students.filter(s => s.has_medical_report);
```

---

### Fase 5: Adicionar Rota e Navegação

#### 5.1 Arquivo: `src/App.tsx`

Adicionar nova rota:
```typescript
import AEE from "./pages/AEE";

// Na seção de Admin Routes:
<Route path="/aee" element={<AdminRoute><AEE /></AdminRoute>} />
```

#### 5.2 Arquivo: `src/components/DashboardLayout.tsx`

Adicionar item no sidebar (allNavigation array):
```typescript
{ name: 'Sistema AEE', href: '/aee', icon: Heart, roles: ['admin', 'direction', 'teacher'] },
```

Usar o ícone `Heart` do Lucide (ou `UserCheck`, `Accessibility` se disponível).

---

### Fase 6: Atualizar Aba "Laudo" na Página de Alunos

**Arquivo**: `src/components/StudentReportModal.tsx`

Atualizar a aba "Laudo" para exibir as informações estruturadas ao invés do texto livre:

```typescript
<TabsContent value="medical">
  {student.has_medical_report ? (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Laudo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-muted-foreground">Idade</Label>
          <p className="font-medium">{calcularIdade(student.birth_date)} anos</p>
        </div>
        <div>
          <Label className="text-muted-foreground">CID</Label>
          <p className="font-medium">
            {student.aee_cid_code ? `${student.aee_cid_code} - ${student.aee_cid_description}` : 'Não informado'}
          </p>
        </div>
        <div>
          <Label className="text-muted-foreground">Uso de Medicação</Label>
          <p className="font-medium">
            {student.aee_uses_medication 
              ? `Sim - ${student.aee_medication_name}` 
              : 'Não'}
          </p>
        </div>
        <div>
          <Label className="text-muted-foreground">Alfabetização</Label>
          <p className="font-medium">
            {student.aee_literacy_status === 'yes' ? 'Sim' : 
             student.aee_literacy_status === 'in_process' ? 'Em processo' : 'Não'}
          </p>
        </div>
        <div>
          <Label className="text-muted-foreground">Atividades Adaptadas</Label>
          <p className="font-medium">
            {student.aee_adapted_activities ? 'Sim' : 'Não'}
          </p>
        </div>
      </CardContent>
    </Card>
  ) : (
    // ...fallback para aluno sem laudo
  )}
</TabsContent>
```

---

### Resumo de Arquivos

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/pages/Home.tsx` | Editar | Trocar título do menu |
| `src/pages/Students.tsx` | Editar | Remover campo "Especificação do Laudo" |
| `supabase/migrations/xxx.sql` | Criar | Novos campos AEE na tabela students |
| `src/pages/AEE.tsx` | Criar | Nova página do Sistema AEE |
| `src/App.tsx` | Editar | Adicionar rota `/aee` |
| `src/components/DashboardLayout.tsx` | Editar | Adicionar link no sidebar |
| `src/components/StudentReportModal.tsx` | Editar | Atualizar aba Laudo com dados estruturados |
| `src/integrations/supabase/types.ts` | Auto | Será atualizado automaticamente |

---

### Diagrama de Fluxo do Sistema AEE

```text
┌──────────────────────────────────────────────────────────────────┐
│                         SISTEMA AEE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐ │
│  │  Sidebar    │    │            Página AEE                   │ │
│  │             │    │  ┌────────────────────────────────────┐ │ │
│  │  Dashboard  │    │  │ Header: Sistema AEE                │ │ │
│  │  Alunos     │    │  └────────────────────────────────────┘ │ │
│  │  Turmas     │    │  ┌────────────────────────────────────┐ │ │
│  │  QR Code    │    │  │ Filtros: Turma | Turno             │ │ │
│  │  Frequência │    │  └────────────────────────────────────┘ │ │
│  │ ►Sistema AEE│    │                                         │ │
│  │  Notificação│    │  ┌───────┐ ┌───────┐ ┌───────┐         │ │
│  │  Config.    │    │  │ Card  │ │ Card  │ │ Card  │         │ │
│  │             │    │  │Aluno 1│ │Aluno 2│ │Aluno 3│         │ │
│  └─────────────┘    │  │       │ │       │ │       │         │ │
│                     │  │[Info] │ │[Info] │ │[Info] │         │ │
│                     │  └───────┘ └───────┘ └───────┘         │ │
│                     └─────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Modal "Informações do Laudo"            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Idade: [XX anos]                                    │  │  │
│  │  │ CID: [Código] - [Descrição]                         │  │  │
│  │  │ Medicação: ( ) Não  ( ) Sim → [Qual]                │  │  │
│  │  │ Alfabetizado: ( ) Não  ( ) Sim  ( ) Em processo     │  │  │
│  │  │ Atividades Adaptadas: ( ) Não  ( ) Sim              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                              [Salvar]  [Cancelar]         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Considerações Técnicas

1. **Idade do Aluno**: Calculada automaticamente a partir do campo `birth_date` existente
2. **Permissões**: Acesso restrito aos roles `admin`, `direction` e `teacher`
3. **Validação**: Campos opcionais, exceto quando "Sim" for selecionado para medicação
4. **RLS**: As políticas existentes já cobrem os novos campos (mesma tabela students)
5. **Migração de Dados**: Os alunos existentes com `has_medical_report = true` terão os novos campos em branco inicialmente, podendo ser preenchidos através do Sistema AEE
