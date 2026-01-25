
## Plano de Implementação: Melhorias no Sistema de Alunos e AEE + Notificações Push

### Resumo das Alterações Solicitadas

1. **Notificações Push para Admin**: Quando um novo usuário se cadastrar, administradores recebem notificação via push
2. **Página Alunos - Click no Card**: Abrir caixa de informações ao clicar em qualquer lugar do card (não apenas no nome)
3. **Página Alunos - Aba "Laudo"**: Incluir todas as informações do laudo do Sistema AEE
4. **Sistema AEE - Modal Somente Leitura**: Ao clicar no card, apresentar informações sem edição
5. **Sistema AEE - Botão "Editar"**: Trocar "Detalhes" por "Editar" e habilitar edição apenas nessa opção

---

### Fase 1: Abrir Modal ao Clicar no Card do Aluno (Students.tsx)

**Arquivo**: `src/pages/Students.tsx`

**Problema Atual**: O modal de informações só abre ao clicar no NOME do aluno (linha 904-908)

**Solução**: Adicionar `onClick` no `Card` inteiro para abrir o `StudentReportModal`

Linhas 884-892 - Adicionar onClick ao Card:
```typescript
<Card
  key={student.id}
  className={cn(
    "card-hover animate-fade-in overflow-hidden cursor-pointer",  // Adicionar cursor-pointer
    student.status === 'inactive' && "border-red-500/50",
    student.has_medical_report && "border-2 border-amber-500 ring-2 ring-amber-500/20"
  )}
  style={{ animationDelay: `${index * 30}ms` }}
  onClick={() => setReportStudent(student)}  // Adicionar onClick
>
```

Linhas 904-908 - Remover onClick do nome (evitar duplo click):
```typescript
<h3 className="font-medium text-sm">
  {student.full_name}
</h3>
```

Linhas 896-902 - Adicionar stopPropagation na foto:
```typescript
<StudentPhoto
  photoUrl={student.photo_url}
  fullName={student.full_name}
  status={student.status}
  size="md"
  onClick={(e) => { 
    e.stopPropagation();
    student.photo_url && setZoomPhotoStudent(student);
  }}
/>
```

---

### Fase 2: Expandir Aba "Laudo" no StudentReportModal

**Arquivo**: `src/components/StudentReportModal.tsx`

**Problema Atual**: A aba "Laudo" mostra apenas CID, Medicação, Alfabetização e Atividades Adaptadas. Faltam:
- Sugestões de Adaptações
- Documento do Laudo (anexo)

**Solução**: Atualizar interface e adicionar campos:

1. Adicionar novos campos à interface Student (linha 14-35):
```typescript
interface Student {
  // ... campos existentes
  aee_adaptation_suggestions?: string | null;
  aee_laudo_attachment_url?: string | null;
}
```

2. Adicionar estado para URL assinada do documento (linha 70-73):
```typescript
const [laudoSignedUrl, setLaudoSignedUrl] = useState<string | null>(null);
```

3. Adicionar função para buscar URL assinada:
```typescript
const fetchLaudoSignedUrl = async (fileName: string) => {
  try {
    const { data, error } = await supabase.storage
      .from('aee-documents')
      .createSignedUrl(fileName, 3600);
    if (!error && data) setLaudoSignedUrl(data.signedUrl);
  } catch (error) {
    console.error('Error getting signed URL:', error);
  }
};
```

4. Chamar no useEffect quando student tiver laudo:
```typescript
useEffect(() => {
  if (student?.aee_laudo_attachment_url) {
    fetchLaudoSignedUrl(student.aee_laudo_attachment_url);
  } else {
    setLaudoSignedUrl(null);
  }
}, [student]);
```

5. Expandir aba "Laudo" (linha 386-450) com:
```typescript
{/* Sugestões de Adaptações */}
{student.aee_adaptation_suggestions && (
  <div>
    <Label className="text-muted-foreground text-sm">Sugestões de Adaptações</Label>
    <div className="mt-1 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
      <p className="text-sm whitespace-pre-wrap">{student.aee_adaptation_suggestions}</p>
    </div>
  </div>
)}

{/* Documento do Laudo */}
{student.aee_laudo_attachment_url && (
  <div>
    <Label className="text-muted-foreground text-sm">Documento do Laudo</Label>
    <div className="mt-1 flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.open(laudoSignedUrl, '_blank')}>
        <FileText className="w-4 h-4 mr-2" />
        Visualizar Documento
      </Button>
    </div>
  </div>
)}
```

---

### Fase 3: Modal do AEE - Modo Somente Leitura

**Arquivo**: `src/pages/AEE.tsx`

**Problema Atual**: O modal abre em modo de edição direta

**Solução**: Criar dois modos: visualização e edição

1. Adicionar estado para controlar modo (linha 55-60):
```typescript
const [isEditMode, setIsEditMode] = useState(false);
```

2. Modificar função `openStudentDialog` para abrir em modo visualização:
```typescript
const openStudentDialog = (student: Student) => {
  setSelectedStudent(student);
  setIsEditMode(false);  // Sempre abre em modo visualização
  // ... resto do código
};
```

3. Criar nova função para abrir em modo edição:
```typescript
const openEditMode = (student: Student) => {
  setSelectedStudent(student);
  setIsEditMode(true);
  setFormData({
    aee_cid_code: student.aee_cid_code || '',
    // ... resto dos campos
  });
  // ... buscar professores e laudo
};
```

4. Modificar a aba "Informações do Laudo" para exibir modo diferente:

**Modo Visualização (isEditMode = false)**:
```typescript
<TabsContent value="laudo">
  {!isEditMode ? (
    <div className="space-y-4">
      {/* Exibição somente leitura - similar ao StudentReportModal */}
      <div>
        <Label className="text-muted-foreground text-sm">CID</Label>
        <p className="font-medium">
          {selectedStudent.aee_cid_code 
            ? `${selectedStudent.aee_cid_code}${selectedStudent.aee_cid_description ? ` - ${selectedStudent.aee_cid_description}` : ''}`
            : 'Não informado'}
        </p>
      </div>
      {/* Medicação, Alfabetização, Atividades, Sugestões, Documento... */}
    </div>
  ) : (
    <div className="space-y-6">
      {/* Formulário de edição existente */}
    </div>
  )}
</TabsContent>
```

5. Alterar botões do footer:
```typescript
<DialogFooter>
  {!isEditMode ? (
    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" onClick={() => setIsEditMode(false)}>
        Cancelar
      </Button>
      <Button onClick={handleSave} disabled={isSaving || isUploadingLaudo}>
        {isSaving || isUploadingLaudo ? 'Salvando...' : 'Salvar'}
      </Button>
    </>
  )}
</DialogFooter>
```

---

### Fase 4: Trocar Botão "Detalhes" por "Editar"

**Arquivo**: `src/pages/AEE.tsx`

**Linhas 622-630** - Alterar o botão no card:

```typescript
// DE:
<Button
  variant="outline"
  className="flex-1"
  onClick={(e) => { e.stopPropagation(); openStudentDialog(student); }}
>
  <FileText className="w-4 h-4 mr-2" />
  Detalhes
</Button>

// PARA:
<Button
  variant="outline"
  className="flex-1"
  onClick={(e) => { 
    e.stopPropagation(); 
    openEditMode(student);  // Abre diretamente em modo edição
  }}
>
  <Edit2 className="w-4 h-4 mr-2" />
  Editar
</Button>
```

Adicionar import do ícone Edit2:
```typescript
import { Search, FileText, Users, Camera, Paperclip, FileDown, Trash2, Eye, Edit2 } from 'lucide-react';
```

---

### Fase 5: Notificações Push para Administradores

**IMPORTANTE**: Esta funcionalidade requer configuração mais complexa envolvendo:

1. **Serviço de Push Notifications**: Firebase Cloud Messaging (FCM) ou similar
2. **Service Worker Customizado**: Para receber e exibir notificações
3. **Edge Function**: Para enviar notificações quando novo usuário se cadastrar
4. **Tabela de Tokens**: Para armazenar tokens de dispositivos dos admins

**Estrutura Proposta**:

1. **Nova tabela no banco de dados**:
```sql
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

2. **Componente de Permissão de Notificação** (Admin Dashboard):
```typescript
// Solicitar permissão e salvar subscription
const requestNotificationPermission = async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });
    // Salvar subscription no banco
  }
};
```

3. **Edge Function para enviar notificação**:
```typescript
// supabase/functions/notify-new-user/index.ts
// Chamada por trigger quando novo usuário é criado
// Busca admins com push_subscriptions e envia notificação
```

4. **Trigger no banco de dados**:
```sql
CREATE OR REPLACE FUNCTION notify_admins_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar edge function para notificar admins
  PERFORM net.http_post(...);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION notify_admins_new_user();
```

**Nota**: Esta funcionalidade requer configuração de VAPID keys e integração com serviço de push. Sugiro implementar as outras alterações primeiro e tratar as notificações push como uma fase separada.

---

### Resumo de Arquivos a Alterar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/pages/Students.tsx` | Editar | onClick no Card inteiro + stopPropagation nos botões |
| `src/components/StudentReportModal.tsx` | Editar | Expandir aba Laudo com todos os campos AEE |
| `src/pages/AEE.tsx` | Editar | Modo visualização/edição + trocar "Detalhes" por "Editar" |
| `supabase/migrations/xxx.sql` | Criar | Tabela push_subscriptions (para notificações) |
| `supabase/functions/notify-new-user/` | Criar | Edge function para notificações |

---

### Fluxo Visual Proposto

**Página Alunos - Click no Card**:
```
┌──────────────────────────────────────┐
│ Card do Aluno                        │  ← Click em qualquer lugar
│ ┌─────┐                              │
│ │Foto │  Nome do Aluno               │
│ └─────┘  ID: XXX                     │
│                                      │
│ Turma: MM100 | Turno: Manhã          │
│                                      │
│ [QR] [Ocorr.] [Edit] [Del]           │  ← Botões mantêm funcionamento
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Modal StudentReportModal             │
│ ┌──────┐ Nome                        │
│ │ Foto │ ID • Turma                  │
│ └──────┘                             │
│                                      │
│ [Frequência] [Ocorrências] [Laudo]   │
│                                      │
│ === Laudo (expandido) ===            │
│ CID: F84.0 - Autismo                 │
│ Medicação: Sim - Ritalina            │
│ Alfabetizado: Em processo            │
│ Atividades Adaptadas: Sim            │
│ Sugestões de Adaptações:             │
│ ┌─────────────────────────────────┐  │
│ │ Texto das sugestões...         │  │
│ └─────────────────────────────────┘  │
│ [📄 Visualizar Documento do Laudo]   │
└──────────────────────────────────────┘
```

**Sistema AEE - Modos**:
```
Modo VISUALIZAÇÃO (click no card):
┌──────────────────────────────────────┐
│ Modal AEE - Visualização             │
│ ┌──────┐ Nome | Turma | Turno        │
│ │ Foto │                             │
│ └──────┘                             │
│                                      │
│ [Professores] [Info. Laudo]          │
│                                      │
│ CID: F84.0 - Autismo                 │  ← Somente leitura
│ Medicação: Sim - Ritalina            │
│ Alfabetizado: Em processo            │
│                                      │
│                           [Fechar]   │
└──────────────────────────────────────┘

Modo EDIÇÃO (click no botão "Editar"):
┌──────────────────────────────────────┐
│ Modal AEE - Edição                   │
│ ┌──────┐ Nome | Turma | Turno        │
│ │ Foto │                             │
│ └──────┘                             │
│                                      │
│ [Professores] [Info. Laudo]          │
│                                      │
│ CID: [_______] [_______________]     │  ← Campos editáveis
│ Medicação: ( ) Não  (•) Sim          │
│ ...                                  │
│                                      │
│                  [Cancelar] [Salvar] │
└──────────────────────────────────────┘
```

---

### Considerações Técnicas

1. **stopPropagation**: Necessário nos botões e foto dentro do card para evitar abrir o modal ao clicar neles
2. **Interface Student**: Atualizar em StudentReportModal para incluir novos campos AEE
3. **Signed URLs**: Necessário para acessar documentos no bucket privado `aee-documents`
4. **Push Notifications**: Requer VAPID keys e configuração de Service Worker customizado - implementação mais complexa que pode ser feita em fase posterior
