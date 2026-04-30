## Ajustes no PEI — Identificação e Adaptações por Disciplina

### 1. Remover campos da seção "Identificação"
**Arquivo:** `src/components/aee/PEIForm.tsx`
- Remover o campo de UI **"Nº matrícula"** (linhas ~243-249).
- Remover o campo de UI **"E-mail"** (linhas ~293-300).
- Manter `enrollment_number` e `email` na interface `PEIData` e em `emptyPEI` para preservar compatibilidade com registros já salvos (não quebra dados existentes), mas deixarão de ser editáveis na UI.

### 2. Renomear "Matemática e Exatas" → "Matemática e Natureza"
**Arquivo:** `src/components/aee/PEIForm.tsx`
- Alterar o `<Label>` da seção 8 de `"Matemática e Exatas"` para `"Matemática e Natureza"` (linha ~513).
- A chave interna `matematica_exatas` permanece a mesma para não quebrar registros já salvos.

**Arquivo:** `src/pages/AEE.tsx`
- Atualizar a tabela de adaptações no PDF (linha ~795): trocar `<td>Matemática e Exatas</td>` por `<td>Matemática e Natureza</td>`.
- Remover a linha **"Nº Matrícula"** da tabela de identificação do PDF (linha ~567).
- Remover a linha **"E-mail"** da tabela de identificação do PDF (linha ~574).

### Resumo

| Arquivo | Mudança |
|---|---|
| `src/components/aee/PEIForm.tsx` | Remover inputs "Nº matrícula" e "E-mail"; renomear label para "Matemática e Natureza" |
| `src/pages/AEE.tsx` | Remover linhas "Nº Matrícula" e "E-mail" do PDF; renomear "Matemática e Exatas" → "Matemática e Natureza" no PDF |

Observação: as colunas de banco e os campos do tipo `PEIData` são mantidos para não invalidar PEIs já salvos — apenas deixam de aparecer na UI e no PDF.