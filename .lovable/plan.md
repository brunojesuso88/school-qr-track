
# Plano de Implementação: Melhorias no Sistema EDUNEXUS

## Resumo das Alterações

1. **Tela Home**: Aumentar tamanho do botão de configurações
2. **QR Codes**: Criar aba de alunos, exportar por turma em PDF, ajustar tamanho/formato
3. **Notificações Push**: Diagnóstico e correção do sistema
4. **Declarações**: Nova aba para Bolsa Família (disponível para Admin/Direção)

---

## Fase 1: Aumentar Botão de Configurações na Home

**Arquivo**: `src/pages/Home.tsx`

**Alteração**: Linhas 168-176

**Atual**:
```typescript
<Button
  variant="ghost"
  size="icon"
  className="absolute top-4 right-4 rounded-full"
>
  <Settings className="h-5 w-5" />
</Button>
```

**Novo**:
```typescript
<Button
  variant="outline"
  size="lg"
  className="absolute top-4 right-4 rounded-full h-12 w-12 shadow-md hover:shadow-lg"
>
  <Settings className="h-6 w-6" />
</Button>
```

---

## Fase 2: Sistema de QR Codes Expandido

### 2.1 Criar Nova Página de Gerenciamento de QR Codes

**Arquivo**: `src/pages/QRCodes.tsx` (novo)

**Funcionalidades**:
- **Aba 1 - Escanear**: Funcionalidade atual do ScanQR
- **Aba 2 - Alunos**: Lista de alunos com opção de gerar QR Code individual
- **Aba 3 - Por Turma**: Gerar e exportar QR codes de todos os alunos de uma turma em PDF

**Estrutura**:
```typescript
// Tabs: Escanear | Alunos | Por Turma
<Tabs defaultValue="scan">
  <TabsList>
    <TabsTrigger value="scan">Escanear</TabsTrigger>
    <TabsTrigger value="students">Alunos</TabsTrigger>
    <TabsTrigger value="byClass">Por Turma</TabsTrigger>
  </TabsList>
  
  <TabsContent value="scan">
    {/* Funcionalidade atual do ScanQR */}
  </TabsContent>
  
  <TabsContent value="students">
    {/* Lista de alunos com busca e filtro por turma */}
    {/* Cada aluno tem botão para gerar/baixar QR individual */}
  </TabsContent>
  
  <TabsContent value="byClass">
    {/* Seleção de turma */}
    {/* Botão "Gerar PDF com QR Codes" */}
    {/* Preview dos QR codes da turma */}
  </TabsContent>
</Tabs>
```

### 2.2 Ajustar Tamanho e Formato do QR Code

**Arquivo**: `src/pages/Students.tsx` (função `downloadQRCode`)

**Alterações**:
- Aumentar tamanho do canvas de 300x350 para 400x500
- Aumentar tamanho do QR de 200x200 para 300x300
- Melhorar espaçamento e fonte

**Novo código**:
```typescript
const downloadQRCode = (student: Student) => {
  const svg = document.getElementById(`qr-${student.id}`);
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = () => {
    canvas.width = 400;
    canvas.height = 500;
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // QR Code maior e centralizado
      ctx.drawImage(img, 50, 30, 300, 300);
      
      // Textos maiores e mais legíveis
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(student.full_name, 200, 370);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#555555';
      ctx.fillText(`ID: ${student.student_id}`, 200, 400);
      ctx.fillText(`Turma: ${student.class}`, 200, 425);
    }
    
    const pngFile = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `qr-${student.student_id}.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };

  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
};
```

### 2.3 Exportação em PDF por Turma

**Nova função** em `src/pages/QRCodes.tsx`:

```typescript
const generateClassQRCodesPDF = async (className: string) => {
  const classStudents = students.filter(s => s.class === className);
  
  // Gerar HTML com grid de QR codes (4 por página)
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .qr-card { 
          border: 1px solid #ddd; 
          padding: 15px; 
          text-align: center;
          page-break-inside: avoid;
        }
        .qr-card img { width: 150px; height: 150px; }
        .student-name { font-weight: bold; margin-top: 10px; }
        .student-info { font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QR Codes - Turma ${className}</h1>
        <p>Total: ${classStudents.length} alunos</p>
      </div>
      <div class="grid">
        ${classStudents.map(student => `
          <div class="qr-card">
            <!-- QR Code SVG inline -->
            <div class="student-name">${student.full_name}</div>
            <div class="student-info">ID: ${student.student_id}</div>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;
  
  // Abrir em nova janela e imprimir como PDF
  const win = window.open('', '_blank');
  win?.document.write(content);
  win?.print();
};
```

### 2.4 Atualizar Rota

**Arquivo**: `src/App.tsx`

```typescript
// Alterar rota /scan para usar nova página QRCodes
<Route path="/scan" element={<QRCodes />} />
```

---

## Fase 3: Correção das Notificações Push

### Problema Identificado

O sistema de push notifications não funciona porque:

1. **Service Worker sem suporte a push**: O VitePWA gera um service worker que não tem handlers para eventos `push` e `notificationclick`
2. **Edge Function incompleta**: A função `notify-new-user` apenas faz log, não envia notificações reais via Web Push API

### Solução

#### 3.1 Criar Service Worker Customizado

**Arquivo**: `public/sw-custom.js` (novo)

```javascript
// Custom Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Nova notificação',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    data: data.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EDUNEXUS', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
```

#### 3.2 Atualizar vite.config.ts

```typescript
VitePWA({
  registerType: 'autoUpdate',
  // Adicionar injectManifest para usar SW customizado
  strategies: 'injectManifest',
  srcDir: 'public',
  filename: 'sw-custom.js',
  // ... resto da config
})
```

#### 3.3 Atualizar Edge Function para Enviar Push Real

**Arquivo**: `supabase/functions/notify-new-user/index.ts`

A edge function precisa usar a Web Push API com criptografia VAPID. Isso requer:

1. Importar biblioteca de criptografia
2. Gerar JWT com VAPID
3. Criptografar payload
4. Enviar para endpoint

```typescript
// Implementação simplificada usando fetch para Push API
const sendPushNotification = async (
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) => {
  // Web Push requer:
  // 1. ECDSA signature (VAPID)
  // 2. Payload encryption (ECDH + AES-GCM)
  
  // Para Deno, usar crypto API nativa
  // Implementação completa requer ~100 linhas
};
```

---

## Fase 4: Aba de Declarações (Bolsa Família)

### 4.1 Estrutura do Banco de Dados (opcional)

Se quiser salvar histórico de declarações geradas:

```sql
CREATE TABLE declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'bolsa_familia',
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  data JSONB NOT NULL
);
```

### 4.2 Nova Página de Declarações

**Arquivo**: `src/pages/Declarations.tsx` (novo)

**Campos do Formulário** (baseado no modelo anexado):

**Dados do Responsável**:
- Nome do Responsável
- RG do Responsável
- CPF do Responsável
- Endereço Completo

**Dados do Aluno** (preenchidos automaticamente):
- Nome do Aluno (select com busca)
- Data de Nascimento
- Turma/Série

**Dados da Escola** (preenchidos automaticamente via settings):
- Nome da Escola
- Endereço da Escola

**Dados da Declaração**:
- Ano Letivo
- Local
- Data
- Nome do Responsável pela Assinatura
- Telefone para Contato

### 4.3 Interface do Formulário

```typescript
interface DeclarationForm {
  // Dados do responsável (guardião)
  guardianName: string;
  guardianRG: string;
  guardianCPF: string;
  guardianAddress: string;
  
  // Dados do aluno (preenchidos ao selecionar)
  studentId: string;
  studentName: string;
  studentBirthDate: string;
  studentClass: string;
  
  // Dados da escola (das configurações)
  schoolName: string;
  schoolAddress: string;
  
  // Dados da declaração
  schoolYear: string;
  location: string;
  declarationDate: Date;
  signerName: string;
  signerPhone: string;
}
```

### 4.4 Fluxo da Página

```
1. Seleção do Aluno (dropdown com busca)
   ↓
   [Preenche automaticamente: Nome, Nascimento, Turma, Nome do Responsável, Telefone]
   
2. Complemento de Dados
   - RG e CPF do Responsável (manual)
   - Endereço do Responsável (manual)
   - Dados da Escola (das configurações)
   
3. Revisão dos Dados
   - Tela de conferência com todos os campos
   - Possibilidade de editar antes de gerar
   
4. Geração do PDF
   - Botão "Gerar Declaração"
   - Abre nova janela com documento formatado
   - Botão de impressão/salvar como PDF
```

### 4.5 Template do PDF

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px 60px;
      line-height: 1.8;
    }
    h1 { 
      text-align: center; 
      font-size: 24px;
      margin-bottom: 30px;
    }
    .content { 
      text-align: justify; 
      margin: 20px 0;
    }
    .signature { 
      margin-top: 60px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 300px;
      margin: 40px auto 10px;
    }
  </style>
</head>
<body>
  <h1>DECLARAÇÃO ESCOLAR</h1>
  
  <p class="content">
    Eu, <strong>${guardianName}</strong>, portador(a) do RG nº 
    <strong>${guardianRG}</strong> e CPF nº <strong>${guardianCPF}</strong>, 
    residente à <strong>${guardianAddress}</strong>, declaro que sou 
    responsável pela educação do(a) aluno(a) <strong>${studentName}</strong>, 
    nascido(a) em <strong>${studentBirthDate}</strong>, matriculado(a) na 
    <strong>${schoolName}</strong> situada à <strong>${schoolAddress}</strong>.
  </p>
  
  <p class="content">
    O(A) aluno(a) encontra-se regularmente matriculado(a) no 
    <strong>${studentClass}</strong> e frequenta as aulas conforme o 
    calendário escolar.
  </p>
  
  <p class="content">
    Esta declaração é emitida para fins de cadastro e/ou atualização no 
    programa Bolsa Família do Governo Federal, conforme solicitado.
  </p>
  
  <p class="content">
    Atesto que, conforme os dados disponíveis, <strong>${studentName}</strong> 
    tem um bom desempenho escolar e frequência compatível com as exigências 
    do referido programa.
  </p>
  
  <p class="content">
    Esta declaração é válida para o ano letivo de <strong>${schoolYear}</strong> 
    e pode ser utilizada para os fins a que se destina.
  </p>
  
  <p class="content">
    Por ser verdade, firmo a presente declaração.
  </p>
  
  <p style="margin-top: 40px;">
    <strong>${location}</strong>, <strong>${declarationDate}</strong>
  </p>
  
  <div class="signature">
    <div class="signature-line"></div>
    <p><strong>${signerName}</strong></p>
    <p>[Assinatura]</p>
    <p>Telefone: ${signerPhone}</p>
  </div>
</body>
</html>
```

### 4.6 Adicionar à Navegação

**Arquivo**: `src/components/DashboardLayout.tsx`

```typescript
import { FileSignature } from 'lucide-react'; // ou outro ícone apropriado

const allNavigation = [
  // ... itens existentes
  { name: 'Declarações', href: '/declarations', icon: FileSignature, roles: ['admin', 'direction'] },
];
```

### 4.7 Adicionar Rota

**Arquivo**: `src/App.tsx`

```typescript
<Route path="/declarations" element={
  <AdminRoute allowedRoles={['admin', 'direction']}>
    <Declarations />
  </AdminRoute>
} />
```

---

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/Home.tsx` | Editar | Aumentar botão de configurações |
| `src/pages/QRCodes.tsx` | Criar | Nova página com abas para QR codes |
| `src/pages/ScanQR.tsx` | Remover/Refatorar | Mover lógica para QRCodes.tsx |
| `src/pages/Students.tsx` | Editar | Melhorar função downloadQRCode |
| `src/pages/Declarations.tsx` | Criar | Formulário e geração de declaração |
| `public/sw-custom.js` | Criar | Service worker para push notifications |
| `vite.config.ts` | Editar | Configurar injectManifest para SW |
| `supabase/functions/notify-new-user/index.ts` | Editar | Implementar envio real de push |
| `src/components/DashboardLayout.tsx` | Editar | Adicionar link "Declarações" |
| `src/App.tsx` | Editar | Adicionar rota /declarations |

---

## Ordem de Implementação Sugerida

1. **Home - Botão de configurações** (5 min)
2. **QR Codes - Tamanho e formato** (10 min)
3. **QR Codes - Nova página com abas** (30 min)
4. **Declarações - Página completa** (45 min)
5. **Push Notifications - Service Worker e Edge Function** (30 min)

---

## Seção Técnica

### Dependências Necessárias

Nenhuma nova dependência é necessária. O sistema usa:
- `qrcode.react` para gerar QR codes (já instalado)
- `date-fns` para formatação de datas (já instalado)
- Web APIs nativas para geração de PDF via window.print()

### Considerações de Segurança

1. **Declarações**: Disponível apenas para `admin` e `direction` via AdminRoute
2. **Push Notifications**: Requer autenticação e role de admin para ativar
3. **QR Codes**: Mantém controle de acesso existente

### Validação de Formulários

O formulário de Declarações usará Zod para validação:

```typescript
const declarationSchema = z.object({
  guardianName: z.string().min(3, 'Nome muito curto'),
  guardianRG: z.string().min(5, 'RG inválido'),
  guardianCPF: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  guardianAddress: z.string().min(10, 'Endereço muito curto'),
  studentId: z.string().uuid('Selecione um aluno'),
  schoolYear: z.string().min(4, 'Ano letivo inválido'),
  location: z.string().min(3, 'Local inválido'),
  signerName: z.string().min(3, 'Nome muito curto'),
  signerPhone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido'),
});
```
