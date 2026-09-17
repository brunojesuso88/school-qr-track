# Atalho de atualização e filtros de Alunos

## Implementação
- Adicionar ao topo um botão compacto de atualização, ao lado do tema, reutilizando o `handleForceUpdate` existente e mantendo a opção nas configurações.
- Reorganizar os filtros de Alunos: busca em largura total; filtros secundários recolhíveis no celular e sempre visíveis no desktop; labels claras, contador ativo e ação para limpar tudo.
- Remover apenas o filtro de status e sua preferência inicial nesta página, mantendo alunos ativos e desistentes juntos e preservando os demais comportamentos.
- Manter intactos cards, cadastro, ocorrências, conselho, IRA, medalhas, frequência, matrizes, boletins e banco.

## Detalhes técnicos
- Alterações restritas a `DashboardLayout.tsx`, `Students.tsx` e, se necessário, testes puros dos filtros.
- O contador incluirá Turma, Turno, Ordenação, Ocorrências, Conselho e Medalhas; a busca também manterá visível a ação de limpar.
- Trocar turno continuará redefinindo uma turma incompatível para “Todas”.

## Verificação
- Validar visualmente topo e Alunos em desktop e 360 px, incluindo abrir filtros e limpar filtros.
- Confirmar no código e na tela que não existe filtragem invisível por status.
- Executar todos os testes, verificação de tipos e build; revisar o diff e informar o SHA real do edit.
