# Excluir turmas voltar a funcionar

## O que acontece hoje
Ao excluir uma turma, o sistema apaga em cadeia tudo o que depende dela (disciplinas da turma, períodos, configuração do IRA, importações de boletim). Cada um desses apagamentos dispara automaticamente a marcação "IRA desatualizado" para a turma — mas nesse momento a turma já não existe mais, então o banco recusa a operação inteira e a tela mostra apenas "Falha ao excluir turma".

Diagnóstico com base no banco: os gatilhos `trg_ira_stale_grade_subjects`, `trg_ira_stale_grade_periods`, `trg_ira_stale_ira_settings` e `trg_ira_stale_student_grades` gravam em `ira_staleness` também em exclusões, e `ira_staleness.class_id` exige uma turma existente. Antes de aplicar a correção, o comportamento será reproduzido uma vez em transação revertida, para registrar a mensagem de erro exata.

## Correção
1. Ajustar as funções `mark_ira_stale_from_class_config` e `mark_ira_stale_from_grade` para não regravar a marcação quando a turma referenciada já não existe mais (checagem da existência da turma antes do `INSERT ... ON CONFLICT`). Nada muda no comportamento normal: alterar notas ou configurações continua marcando o IRA como desatualizado.
2. Na tela de Turmas, mostrar a mensagem real devolvida pelo banco em vez do texto genérico, para que qualquer bloqueio futuro (por exemplo falta de permissão) fique claro para quem usa.
3. Manter a exclusão restrita a quem tem a permissão `classes.delete` na escola — nenhuma política de acesso será afrouxada.

## Verificação
- Reproduzir a exclusão em transação revertida antes e depois da correção, confirmando erro antes e sucesso depois.
- Conferir que a contagem de notas (`student_grades`) de outras turmas permanece intacta e que a turma excluída deixa de constar.
- Rodar a suíte de testes, o typecheck e o build.

## Detalhes técnicos
- Migração: `CREATE OR REPLACE FUNCTION` das duas funções `SECURITY DEFINER`, sem alterar assinaturas nem recriar gatilhos.
- Guard: `IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_class) THEN RETURN OLD; END IF;`
- Frontend: `src/pages/Classes.tsx` (`handleDelete`) passa a exibir `error.message` traduzida/curta no toast.
