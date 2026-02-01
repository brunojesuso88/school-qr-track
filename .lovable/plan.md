

# Plano: Correcao do Salvamento de Disponibilidade de Professores

## Problema Identificado

A tabela `teacher_availability` possui uma constraint no banco de dados que restringe `period_number` para valores entre 1 e 6:

```sql
CHECK (((period_number >= 1) AND (period_number <= 6)))
```

O codigo atual em `TeacherForm.tsx` usa offsets para diferenciar turnos:
- Manha: period_number 1-6 (offset 0)
- Tarde: period_number 7-12 (offset 6)
- Noite: period_number 13-18 (offset 12)

Isso causa o erro ao salvar porque valores como 7, 8, 12, 13, etc. violam a constraint.

---

## Solucao Proposta

### Opcao 1: Alterar a constraint no banco (Recomendada)

Remover a constraint atual e adicionar uma nova que permita valores de 1-18 para suportar os 3 turnos:

```sql
ALTER TABLE teacher_availability 
DROP CONSTRAINT teacher_availability_period_number_check;

ALTER TABLE teacher_availability 
ADD CONSTRAINT teacher_availability_period_number_check 
CHECK ((period_number >= 1) AND (period_number <= 18));
```

Esta solucao mantem a logica atual do codigo que ja foi implementada e testada, onde:
- Manha: horarios 1-6
- Tarde: horarios 7-12
- Noite: horarios 13-18

---

## Resumo das Alteracoes

| Local | Alteracao |
|-------|-----------|
| Banco de dados | Alterar constraint `teacher_availability_period_number_check` para permitir valores 1-18 |

---

## Beneficios

1. Corrige o erro de salvamento imediatamente
2. Mantem a logica simples e clara de diferenciar turnos por ranges de period_number
3. Nao requer alteracoes no codigo frontend

