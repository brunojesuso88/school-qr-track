

# Plano: Corrigir botao "Adicionar em Lote (PDF)"

## Problema

O `Dialog` do formulario individual (linhas 101-131) **envolve** o `DropdownMenu`. Quando o usuario clica em "Adicionar em Lote (PDF)", o clique propaga para o `Dialog` pai, que intercepta o evento e abre o dialog do formulario individual em vez do dialog de importacao em lote. Os dois controles estao aninhados incorretamente.

## Solucao

Separar o `Dialog` do formulario individual do `DropdownMenu`, tornando-os componentes irmaos em vez de pai/filho.

### `src/pages/mapping/MappingTeachers.tsx`

**Antes (estrutura):**
```
<Dialog>          ← envolve tudo
  <DropdownMenu>  ← trigger e menu dentro do Dialog
    ...
  </DropdownMenu>
  <DialogContent> ← conteudo do form individual
    ...
  </DialogContent>
</Dialog>
```

**Depois (estrutura):**
```
<DropdownMenu>    ← independente
  ...
</DropdownMenu>
<Dialog>          ← separado, so o form individual
  <DialogContent>
    ...
  </DialogContent>
</Dialog>
```

Tambem corrigir o erro de build pre-existente em `usePushNotifications.ts` adicionando `// @ts-ignore` antes dos acessos a `pushManager`.

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingTeachers.tsx` | Separar Dialog e DropdownMenu em componentes irmaos |
| `src/hooks/usePushNotifications.ts` | Adicionar `// @ts-ignore` nos 3 acessos a `pushManager` |

