import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClassSubject {
  id: string;
  class_id: string;
  subject_name: string;
  teacher_id: string | null;
  weekly_classes: number;
}

interface TeacherAvailability {
  teacher_id: string;
  day_of_week: number;
  period_number: number;
  available: boolean;
}

interface TimetableEntry {
  class_id: string;
  subject_name: string;
  teacher_id: string | null;
  day_of_week: number;
  period_number: number;
  is_locked: boolean;
}

interface TimetableRule {
  rule_type: string;
  rule_name: string;
  is_active: boolean;
  priority: number;
  parameters: Record<string, unknown> | null;
}

interface MappingClass {
  id: string;
  name: string;
  shift: string;
  weekly_hours: number;
}

interface MappingTeacher {
  id: string;
  name: string;
  max_weekly_hours: number;
  current_hours: number;
  subjects: string[] | null;
}

interface ConflictInput {
  type: string;
  message: string;
  severity: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, classIds, conflicts: inputConflicts } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle suggest_fixes action
    if (action === 'suggest_fixes') {
      console.log('Generating deep analysis for conflicts...');
      
      if (!inputConflicts || inputConflicts.length === 0) {
        return new Response(JSON.stringify({
          suggestions: ['Nenhum conflito encontrado para analisar.']
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [
        { data: teachersData },
        { data: availabilityData },
        { data: entriesData },
        { data: classesData }
      ] = await Promise.all([
        supabase.from('mapping_teachers').select('*'),
        supabase.from('teacher_availability').select('*'),
        supabase.from('timetable_entries').select('*'),
        supabase.from('mapping_classes').select('*')
      ]);

      const teachers = teachersData || [];
      const availability = availabilityData || [];
      const entries = entriesData || [];
      const classes = classesData || [];

      const teacherWorkload = new Map<string, number>();
      entries.forEach((e: TimetableEntry) => {
        if (e.teacher_id) {
          teacherWorkload.set(e.teacher_id, (teacherWorkload.get(e.teacher_id) || 0) + 1);
        }
      });

      const teacherAvailabilitySummary = teachers.map((t: MappingTeacher) => {
        const teacherAvail = availability.filter((a: TeacherAvailability) => a.teacher_id === t.id);
        const availableSlots = teacherAvail.filter((a: TeacherAvailability) => a.available).length;
        const totalSlots = teacherAvail.length;
        const workload = teacherWorkload.get(t.id) || 0;
        
        return {
          id: t.id,
          name: t.name,
          maxHours: t.max_weekly_hours,
          currentWorkload: workload,
          availableSlots,
          totalSlots,
          utilizationRate: t.max_weekly_hours > 0 ? Math.round((workload / t.max_weekly_hours) * 100) : 0
        };
      });

      const conflictList = (inputConflicts as ConflictInput[]).map((c, i) => 
        `${i + 1}. [${c.severity.toUpperCase()}] ${c.message}`
      ).join('\n');

      const suggestPrompt = `Você é um especialista em criação de horários escolares. Faça uma análise PROFUNDA dos conflitos e proponha soluções concretas.

CONFLITOS ENCONTRADOS:
${conflictList}

DADOS DOS PROFESSORES:
${JSON.stringify(teacherAvailabilitySummary, null, 2)}

TURMAS CADASTRADAS:
${classes.map((c: MappingClass) => `- ${c.name} (${c.shift})`).join('\n')}

INSTRUÇÕES:
1. Analise cada conflito em detalhes
2. Identifique os professores envolvidos
3. Proponha MÚLTIPLAS opções de solução para cada conflito
4. Para cada sugestão, explique o IMPACTO

Forneça 5-7 sugestões práticas e específicas.
Responda APENAS com um JSON array de strings. Exemplo:
["Sugestão 1 com detalhes...", "Sugestão 2 com detalhes..."]`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: suggestPrompt }],
          temperature: 0.5,
          max_tokens: 3000
        }),
      });

      if (!aiResponse.ok) {
        console.error('AI Gateway error:', aiResponse.status);
        return new Response(JSON.stringify({
          suggestions: [
            'Revise a disponibilidade dos professores envolvidos nos conflitos.',
            'Considere redistribuir as aulas ao longo de dias diferentes.',
            'Verifique professores com baixa taxa de utilização.',
            'Analise se há professores sobrecarregados.',
            'Tente agendar manualmente as aulas conflitantes.'
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      let suggestions: string[] = [];
      try {
        const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        suggestions = [
          'Revise a disponibilidade dos professores envolvidos nos conflitos.',
          'Considere redistribuir as aulas ao longo de dias diferentes.',
          'Verifique se há professores sobrecarregados.',
          'Analise professores com capacidade disponível.',
          'Tente agendar manualmente as aulas conflitantes.'
        ];
      }

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =============================================
    // TIMETABLE GENERATION - CLASS BY CLASS LOOP
    // =============================================
    if (!classIds || classIds.length === 0) {
      throw new Error('Nenhuma turma selecionada');
    }

    // Fetch all necessary data
    const [
      { data: classes },
      { data: allClassSubjects },
      { data: teachers },
      { data: availability },
      { data: rules },
      { data: settings },
      { data: allExistingEntries }
    ] = await Promise.all([
      supabase.from('mapping_classes').select('*').in('id', classIds),
      supabase.from('mapping_class_subjects').select('*').in('class_id', classIds),
      supabase.from('mapping_teachers').select('*'),
      supabase.from('teacher_availability').select('*'),
      supabase.from('timetable_rules').select('*').eq('is_active', true).order('priority', { ascending: false }),
      supabase.from('timetable_settings').select('*').limit(1).single(),
      // FIX: Fetch ALL entries to detect teacher conflicts across ALL classes
      supabase.from('timetable_entries').select('*')
    ]);

    if (!classes || classes.length === 0) {
      throw new Error('Turmas não encontradas');
    }

    if (!allClassSubjects || allClassSubjects.length === 0) {
      throw new Error('Nenhuma disciplina configurada para as turmas');
    }

    const periodsPerDay = settings?.periods_per_day || 6;
    const daysPerWeek = settings?.days_per_week || 5;

    // Build availability map
    const availabilityMap = new Map<string, boolean>();
    (availability || []).forEach((a: TeacherAvailability) => {
      availabilityMap.set(`${a.teacher_id}-${a.day_of_week}-${a.period_number}`, a.available);
    });

    const teacherInfo = (teachers || []).map((t: MappingTeacher) => ({
      id: t.id,
      name: t.name,
      maxHours: t.max_weekly_hours,
      subjects: t.subjects || []
    }));

    const activeRules = (rules || []).map((r: TimetableRule) => ({
      type: r.rule_type,
      name: r.rule_name,
      priority: r.priority,
      params: r.parameters
    }));

    const allEntries = allExistingEntries || [];

    // Separate locked entries of selected classes and entries of OTHER classes
    const lockedEntriesSelected = allEntries.filter(
      (e: TimetableEntry) => classIds.includes(e.class_id) && e.is_locked
    );
    const entriesOtherClasses = allEntries.filter(
      (e: TimetableEntry) => !classIds.includes(e.class_id)
    );

    // Build global occupied teacher slots from:
    // 1) Locked entries of selected classes
    // 2) ALL entries from other classes (they won't be deleted)
    const globalTeacherOccupied = new Map<string, string>(); // "teacherId-day-period" -> className
    
    // Map class IDs to names for better prompts
    const allClassesMap = new Map<string, string>();
    (classes as MappingClass[]).forEach(c => allClassesMap.set(c.id, c.name));
    
    // Also fetch other class names if needed
    const otherClassIds = [...new Set(entriesOtherClasses.map((e: TimetableEntry) => e.class_id))];
    if (otherClassIds.length > 0) {
      const { data: otherClasses } = await supabase.from('mapping_classes').select('id, name').in('id', otherClassIds);
      (otherClasses || []).forEach((c: { id: string; name: string }) => allClassesMap.set(c.id, c.name));
    }

    // Register occupied slots from other classes
    entriesOtherClasses.forEach((e: TimetableEntry) => {
      if (e.teacher_id) {
        const key = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        globalTeacherOccupied.set(key, allClassesMap.get(e.class_id) || e.class_id);
      }
    });

    // Register occupied slots from locked entries of selected classes
    lockedEntriesSelected.forEach((e: TimetableEntry) => {
      if (e.teacher_id) {
        const key = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        globalTeacherOccupied.set(key, allClassesMap.get(e.class_id) || e.class_id);
      }
    });

    // Delete non-locked entries for selected classes BEFORE generation
    await supabase
      .from('timetable_entries')
      .delete()
      .in('class_id', classIds)
      .eq('is_locked', false);

    console.log(`Starting class-by-class generation for ${classIds.length} classes...`);

    // =============================================
    // GENERATE CLASS BY CLASS TO AVOID TOKEN OVERFLOW
    // =============================================
    const allGeneratedEntries: TimetableEntry[] = [];
    const errors: string[] = [];

    for (const classId of classIds) {
      const cls = (classes as MappingClass[]).find(c => c.id === classId);
      if (!cls) continue;

      const classSubjects = (allClassSubjects as ClassSubject[]).filter(cs => cs.class_id === classId);
      if (classSubjects.length === 0) continue;

      // Build locked slots for this specific class
      const lockedForThisClass = lockedEntriesSelected.filter(e => e.class_id === classId);
      const classOccupiedSlots: string[] = [];
      lockedForThisClass.forEach((e: TimetableEntry) => {
        classOccupiedSlots.push(`${e.class_id}-${e.day_of_week}-${e.period_number}`);
      });

      // Build teacher restrictions string
      const teacherRestrictions: string[] = [];
      globalTeacherOccupied.forEach((className, key) => {
        // key format: "teacherId-dayOfWeek-periodNumber"
        const parts = key.split('-');
        const teacherId = parts.slice(0, 5).join('-'); // UUID has 5 parts with dashes
        const dayOfWeek = parts[5];
        const periodNumber = parts[6];
        const teacher = teacherInfo.find(t => t.id === teacherId);
        const teacherName = teacher?.name || teacherId;
        teacherRestrictions.push(
          `Professor "${teacherName}" (${teacherId}) NÃO pode ser usado no dia ${dayOfWeek}, período ${periodNumber} (já alocado na turma ${className})`
        );
      });

      const subjectsInfo = classSubjects.map(cs => ({
        name: cs.subject_name,
        teacherId: cs.teacher_id,
        weeklyClasses: cs.weekly_classes
      }));

      const systemPrompt = `Você é um sistema especializado em criar horários escolares.
Crie o horário para UMA turma respeitando TODAS as restrições.

REGRAS CRÍTICAS:
1. Um professor NÃO pode ter duas aulas no mesmo horário (verifique as RESTRIÇÕES DE PROFESSORES abaixo)
2. Respeitar a disponibilidade dos professores
3. Distribuir as aulas de cada disciplina ao longo da semana (evitar aulas seguidas da mesma disciplina, exceto se necessário por carga horária)
4. Priorizar o início do dia para disciplinas mais complexas (Matemática, Português)
5. Cada slot (dia+período) da turma deve ter NO MÁXIMO 1 aula

Formato de resposta: JSON array com objetos contendo:
{ "classId": "${classId}", "subjectName": "nome", "teacherId": "id|null", "dayOfWeek": 1-5, "periodNumber": 1-${periodsPerDay} }

Dias: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta
Períodos: 1 ao ${periodsPerDay}`;

      const userPrompt = `Crie o horário para a turma "${cls.name}" (turno: ${cls.shift}).

DISCIPLINAS DA TURMA:
${JSON.stringify(subjectsInfo, null, 2)}

PROFESSORES DISPONÍVEIS:
${JSON.stringify(teacherInfo, null, 2)}

REGRAS PEDAGÓGICAS ATIVAS:
${JSON.stringify(activeRules, null, 2)}

SLOTS JÁ OCUPADOS DESTA TURMA (entradas travadas, NÃO usar estes slots):
${JSON.stringify(classOccupiedSlots, null, 2)}

${teacherRestrictions.length > 0 ? `RESTRIÇÕES DE PROFESSORES (estes professores JÁ TÊM aula nos horários indicados e NÃO podem ser usados nesses slots):
${teacherRestrictions.join('\n')}` : 'Nenhuma restrição de professor de outras turmas.'}

DISPONIBILIDADE DOS PROFESSORES (formato: teacherId-dia-periodo = disponível):
${JSON.stringify(Object.fromEntries(availabilityMap), null, 2)}

Gere APENAS o JSON array com as aulas para esta turma. Nenhum texto adicional.`;

      console.log(`Generating for class ${cls.name} (${classId})...`);

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 16000
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI error for class ${cls.name}:`, aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            errors.push(`Turma ${cls.name}: Limite de requisições excedido. Tente novamente em alguns minutos.`);
            break; // Stop generating more classes if rate limited
          }
          if (aiResponse.status === 402) {
            errors.push(`Turma ${cls.name}: Créditos insuficientes.`);
            break;
          }
          errors.push(`Turma ${cls.name}: Erro na IA (${aiResponse.status})`);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          errors.push(`Turma ${cls.name}: Resposta vazia da IA`);
          continue;
        }

        // Parse response
        let classEntries: TimetableEntry[] = [];
        try {
          const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            classEntries = parsed.map((e: Record<string, unknown>) => ({
              class_id: e.classId as string,
              subject_name: e.subjectName as string,
              teacher_id: e.teacherId as string | null,
              day_of_week: e.dayOfWeek as number,
              period_number: e.periodNumber as number,
              is_locked: false
            }));
          } else {
            errors.push(`Turma ${cls.name}: JSON não encontrado na resposta da IA`);
            continue;
          }
        } catch (parseError) {
          console.error(`Parse error for class ${cls.name}:`, parseError);
          errors.push(`Turma ${cls.name}: Erro ao processar resposta da IA`);
          continue;
        }

        // Validate entries
        const validEntries = classEntries.filter(e =>
          e.class_id &&
          e.subject_name &&
          e.day_of_week >= 1 &&
          e.day_of_week <= daysPerWeek &&
          e.period_number >= 1 &&
          e.period_number <= periodsPerDay &&
          // Ensure not conflicting with locked slots
          !classOccupiedSlots.includes(`${e.class_id}-${e.day_of_week}-${e.period_number}`)
        );

        allGeneratedEntries.push(...validEntries);

        // Update global occupied slots with newly generated entries for next class iteration
        validEntries.forEach((e: TimetableEntry) => {
          if (e.teacher_id) {
            const key = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
            globalTeacherOccupied.set(key, cls.name);
          }
        });

        console.log(`Class ${cls.name}: ${validEntries.length} entries generated`);
      } catch (classError) {
        console.error(`Error generating for class ${cls.name}:`, classError);
        errors.push(`Turma ${cls.name}: Erro inesperado`);
      }
    }

    // Insert all generated entries
    if (allGeneratedEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('timetable_entries')
        .insert(allGeneratedEntries);
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Erro ao salvar horário no banco');
      }
    }

    // Calculate quality score
    let conflictsCount = 0;
    const teacherSlots = new Map<string, number>();
    const classSlots = new Map<string, number>();
    
    [...lockedEntriesSelected, ...allGeneratedEntries].forEach(e => {
      if (e.teacher_id) {
        const teacherKey = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        teacherSlots.set(teacherKey, (teacherSlots.get(teacherKey) || 0) + 1);
      }
      const classKey = `${e.class_id}-${e.day_of_week}-${e.period_number}`;
      classSlots.set(classKey, (classSlots.get(classKey) || 0) + 1);
    });

    // Also check against other classes' entries for teacher conflicts
    entriesOtherClasses.forEach((e: TimetableEntry) => {
      if (e.teacher_id) {
        const teacherKey = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        teacherSlots.set(teacherKey, (teacherSlots.get(teacherKey) || 0) + 1);
      }
    });

    teacherSlots.forEach(count => { if (count > 1) conflictsCount++; });
    classSlots.forEach(count => { if (count > 1) conflictsCount++; });

    const qualityScore = Math.max(0, 100 - (conflictsCount * 10));

    // Save to history
    await supabase.from('timetable_generation_history').insert({
      quality_score: qualityScore,
      conflicts_count: conflictsCount,
      status: conflictsCount === 0 ? 'success' : 'warning',
      explanation: `Horário gerado com ${allGeneratedEntries.length} aulas para ${classIds.length} turma(s). ${conflictsCount} conflitos encontrados.${errors.length > 0 ? ' Erros: ' + errors.join('; ') : ''}`,
      snapshot: { entries: allGeneratedEntries, lockedEntries: lockedEntriesSelected }
    });

    console.log(`Timetable generated: ${allGeneratedEntries.length} entries, ${conflictsCount} conflicts, score: ${qualityScore}`);

    const explanation = errors.length > 0
      ? `Horário gerado com ${allGeneratedEntries.length} aulas. ${conflictsCount} conflitos. Erros em algumas turmas: ${errors.join('; ')}`
      : conflictsCount === 0
        ? `Horário gerado com sucesso! ${allGeneratedEntries.length} aulas alocadas para ${classIds.length} turma(s) sem conflitos.`
        : `Horário gerado com ${allGeneratedEntries.length} aulas para ${classIds.length} turma(s). ${conflictsCount} conflitos precisam de revisão manual.`;

    return new Response(JSON.stringify({
      success: true,
      entriesCount: allGeneratedEntries.length,
      conflictsCount,
      qualityScore,
      explanation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-timetable:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
