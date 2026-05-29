## Botão "Atualizar Turmas" em Mapeamento Escolar

Adicionar um botão **Atualizar** na página `Mapeamento Escolar → Turmas` que sincroniza automaticamente as turmas cadastradas no módulo **Sistema de Gestão** (tabela `classes`) para a tabela `mapping_classes`.

### Comportamento

1. Botão **"Atualizar do Sistema"** ao lado do botão "Adicionar" em `MappingClasses.tsx`.
2. Ao clicar:
   - Busca todas as turmas de `classes` com `status = 'active'`.
   - Busca todas as turmas existentes em `mapping_classes`.
   - Compara por **nome** (case-insensitive, trim).
   - Para cada turma da Gestão que **não existe** no mapeamento: insere em `mapping_classes` com:
     - `name` = nome da turma de gestão
     - `shift` = shift correspondente (morning/afternoon/evening)
     - `weekly_hours` = padrão por turno (Manhã/Tarde = 30, Noite = 25)
     - `student_count` = null (já que classes da Gestão não armazenam contagem direta — pode ser preenchida depois)
   - Turmas que já existem são **ignoradas** (não sobrescreve dados manualmente ajustados).
3. Toast com resumo: `X turmas adicionadas · Y já existentes`.
4. `refreshData()` do contexto ao final para atualizar a UI.

### Detalhes Técnicos

- **Arquivo único alterado**: `src/pages/mapping/MappingClasses.tsx`
  - Adicionar handler `handleSyncFromManagement` (consulta `supabase.from('classes').select('name, shift')` + insert em lote em `mapping_classes`).
  - Adicionar `<Button variant="outline">` com ícone `RefreshCw` (lucide-react), com estado de loading.
- **Sem migração**: schema atual já comporta a operação.
- **RLS**: ambas as tabelas permitem SELECT/INSERT para `admin`/`direction`, que é o público desta tela.
- **Sem alterações** em `SchoolMappingContext`, types, ou edge functions.

### Fora de escopo

- Não remove turmas do mapeamento que não existem mais na Gestão (evita perda de configuração de disciplinas vinculadas).
- Não atualiza `shift` de turmas já existentes (o usuário pode tê-lo ajustado).