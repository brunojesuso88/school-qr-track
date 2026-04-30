## Ajustes no PEI — rótulo de disciplina e PDF

### 1. Rótulo do campo (Adaptações por Disciplina)
**Arquivo:** `src/components/aee/PEIForm.tsx` (linha 497)

- Alterar o `<Label>` de `"Língua Portuguesa e Humanas"` para `"Língua Portuguesa"`.
- (Os campos `matematica_exatas` e `ciencias_humanas` permanecem inalterados — o pedido é apenas para o primeiro rótulo.)

### 2. PDF do PEI
**Arquivo:** `src/pages/AEE.tsx`

**a) Aumentar o logo da escola** (linhas 600-604)
- Alterar `.institutional-header img` de `width: 84px; height: 84px` para `width: 130px; height: 130px` (mantendo `object-fit: contain`).
- Aumentar levemente o `gap` do header para acomodar a nova proporção, se necessário.

**b) Remover linha "PEI gerado em..."** (linhas 821-824)
- Remover por completo o bloco `<p class="footer">PEI gerado em ...</p>`.
- Remover também a regra CSS `.footer` se ficar órfã (sem outros usos).

**c) Atualizar o rótulo na tabela de adaptações do PDF** (linha 794, para manter consistência com a UI)
- Trocar `<td>Língua Portuguesa e Humanas</td>` por `<td>Língua Portuguesa</td>`.

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/aee/PEIForm.tsx` | Rótulo "Língua Portuguesa e Humanas" → "Língua Portuguesa" |
| `src/pages/AEE.tsx` | Logo do PDF 84px → 130px; remover rodapé "PEI gerado em..."; atualizar rótulo na tabela do PDF |
