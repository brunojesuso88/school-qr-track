

# Plano: "Sobre o Sistema" + Importacao de Professores em Lote via PDF

## 1. Botao "Sobre o Sistema" na Home (Configuracoes)

### Arquivo: `src/pages/Home.tsx`

Adicionar um botao "Sobre o Sistema" na secao "Aplicativo" do Sheet de configuracoes. Ao clicar, abre um Dialog com todas as informacoes do sistema organizadas em topicos:

- Nome do sistema (EDUNEXUS)
- Descricao geral
- Modulos: Gestao de Alunos, Frequencia por QR Code, AEE, Mapeamento Escolar, Geracao de Horario com IA, Declaracoes, Notificacoes
- Funcionalidades-chave de cada modulo (em acordeao ou lista)
- Tecnologias (PWA, responsivo, etc.)
- Creditos (Bruno Oliveira)
- Versao

Componentes utilizados: `Dialog`, `ScrollArea`, `Accordion` para organizar os topicos de forma colapsavel.

### Novo componente: `src/components/AboutSystemDialog.tsx`

Componente dedicado com todo o conteudo "Sobre o Sistema" usando Accordion para cada modulo. Importado no Home.tsx.

---

## 2. Importacao de Professores em Lote via PDF

### Arquivo: `src/pages/mapping/MappingTeachers.tsx`

Substituir o botao "Adicionar" simples por um `DropdownMenu` com duas opcoes:
- "Adicionar Professor" (abre o form individual existente)
- "Adicionar em Lote (PDF)" (abre um novo dialog)

### Novo componente: `src/components/mapping/TeacherBulkImportDialog.tsx`

Dialog que:
1. Solicita upload de um PDF
2. Envia o PDF (base64) para uma Edge Function
3. Exibe tabela de revisao com professores extraidos (nome, email, telefone, carga horaria)
4. Permite selecionar/deselecionar professores individualmente
5. Ao confirmar, insere todos os selecionados via `addTeacher` do contexto

### Nova Edge Function: `supabase/functions/parse-teachers-pdf/index.ts`

Baseada na `parse-students-pdf` existente, adaptada para extrair dados de professores:
- Nome completo (obrigatorio)
- E-mail (se disponivel)
- Telefone (se disponivel)
- Carga horaria semanal (se disponivel, default 20h)

Usa o modelo `google/gemini-2.5-flash` via Lovable AI Gateway com tool calling para estruturar a resposta.

### Config: `supabase/config.toml`

Adicionar entrada para a nova funcao:
```toml
[functions.parse-teachers-pdf]
verify_jwt = false
```

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Home.tsx` | Adicionar botao "Sobre o Sistema" e dialog |
| `src/components/AboutSystemDialog.tsx` | Novo componente com conteudo completo do sistema |
| `src/pages/mapping/MappingTeachers.tsx` | DropdownMenu no botao Adicionar + dialog de importacao em lote |
| `src/components/mapping/TeacherBulkImportDialog.tsx` | Novo componente para importacao em lote via PDF |
| `supabase/functions/parse-teachers-pdf/index.ts` | Nova Edge Function para extrair professores de PDF |

