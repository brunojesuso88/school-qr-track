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
  // Handle CORS preflight
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

    // Handle suggest_fixes action with deep analysis
    if (action === 'suggest_fixes') {
      console.log('Generating deep analysis for conflicts...');
      
      if (!inputConflicts || inputConflicts.length === 0) {
        return new Response(JSON.stringify({
          suggestions: ['Nenhum conflito encontrado para analisar.']
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch additional context for deep analysis
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

      // Build teacher workload map
      const teacherWorkload = new Map<string, number>();
      entries.forEach((e: TimetableEntry) => {
        if (e.teacher_id) {
          teacherWorkload.set(e.teacher_id, (teacherWorkload.get(e.teacher_id) || 0) + 1);
        }
      });

      // Build availability summary per teacher
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
3. Proponha MÚLTIPLAS opções de solução para cada conflito, incluindo:
   - Mudanças na disponibilidade dos professores (especificar DIA e HORÁRIO)
   - Redistribuição de aulas entre professores
   - Ajustes na carga horária
4. Para cada sugestão, explique o IMPACTO (quantos conflitos resolve, consequências)

Forneça 5-7 sugestões práticas e específicas. Seja objetivo e inclua detalhes concretos como:
- "Professor X poderia adicionar disponibilidade na Segunda-feira, 3º horário"
- "Mover aula de Matemática da turma Y para Quarta-feira liberaria o conflito com..."
- "Redistribuir 2 aulas do Professor Z para o Professor W que tem capacidade disponível"

Responda APENAS com um JSON array de strings, cada string sendo uma sugestão detalhada. Exemplo:
["Sugestão 1 com detalhes...", "Sugestão 2 com detalhes..."]`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'user', content: suggestPrompt }
          ],
          temperature: 0.5,
          max_tokens: 3000
        }),
      });

      if (!aiResponse.ok) {
        console.error('AI Gateway error:', aiResponse.status);
        // Fallback suggestions based on available data
        const fallbackSuggestions = [
          'Revise a disponibilidade dos professores envolvidos nos conflitos - verifique se há horários bloqueados desnecessariamente.',
          'Considere redistribuir as aulas ao longo de dias diferentes para evitar sobreposições.',
          'Verifique professores com baixa taxa de utilização que poderiam assumir mais aulas.',
          'Analise se há professores sobrecarregados que precisam de ajuste na carga horária.',
          'Tente agendar manualmente as aulas conflitantes em horários alternativos disponíveis.'
        ];
        
        return new Response(JSON.stringify({
          suggestions: fallbackSuggestions
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      let suggestions: string[] = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        suggestions = [
          'Revise a disponibilidade dos professores envolvidos nos conflitos.',
          'Considere redistribuir as aulas ao longo de dias diferentes.',
          'Verifique se há professores sobrecarregados que precisam de ajuste na carga horária.',
          'Analise professores com capacidade disponível que poderiam assumir mais aulas.',
          'Tente agendar manualmente as aulas conflitantes em horários alternativos.'
        ];
      }

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Original timetable generation logic
    if (!classIds || classIds.length === 0) {
      throw new Error('Nenhuma turma selecionada');
    }

    // Fetch all necessary data
    const [
      { data: classes },
      { data: classSubjects },
      { data: teachers },
      { data: availability },
      { data: rules },
      { data: settings },
      { data: existingEntries }
    ] = await Promise.all([
      supabase.from('mapping_classes').select('*').in('id', classIds),
      supabase.from('mapping_class_subjects').select('*').in('class_id', classIds),
      supabase.from('mapping_teachers').select('*'),
      supabase.from('teacher_availability').select('*'),
      supabase.from('timetable_rules').select('*').eq('is_active', true).order('priority', { ascending: false }),
      supabase.from('timetable_settings').select('*').limit(1).single(),
      supabase.from('timetable_entries').select('*').in('class_id', classIds)
    ]);

    if (!classes || classes.length === 0) {
      throw new Error('Turmas não encontradas');
    }

    if (!classSubjects || classSubjects.length === 0) {
      throw new Error('Nenhuma disciplina configurada para as turmas');
    }

    const periodsPerDay = settings?.periods_per_day || 6;
    const daysPerWeek = settings?.days_per_week || 5;

    // Build availability map
    const availabilityMap = new Map<string, boolean>();
    (availability || []).forEach((a: TeacherAvailability) => {
      availabilityMap.set(`${a.teacher_id}-${a.day_of_week}-${a.period_number}`, a.available);
    });

    // Build teacher workload map
    const teacherWorkload = new Map<string, number>();
    (teachers || []).forEach((t: MappingTeacher) => {
      teacherWorkload.set(t.id, 0);
    });

    // Keep locked entries
    const lockedEntries = (existingEntries || []).filter((e: TimetableEntry) => e.is_locked);
    lockedEntries.forEach((e: TimetableEntry) => {
      if (e.teacher_id) {
        teacherWorkload.set(e.teacher_id, (teacherWorkload.get(e.teacher_id) || 0) + 1);
      }
    });

    // Build occupied slots map
    const occupiedSlots = new Map<string, boolean>();
    lockedEntries.forEach((e: TimetableEntry) => {
      occupiedSlots.set(`${e.class_id}-${e.day_of_week}-${e.period_number}`, true);
      if (e.teacher_id) {
        occupiedSlots.set(`teacher-${e.teacher_id}-${e.day_of_week}-${e.period_number}`, true);
      }
    });

    // Prepare the prompt for AI
    const classInfo = (classes as MappingClass[]).map(c => ({
      id: c.id,
      name: c.name,
      shift: c.shift,
      subjects: (classSubjects as ClassSubject[])
        .filter(cs => cs.class_id === c.id)
        .map(cs => ({
          name: cs.subject_name,
          teacherId: cs.teacher_id,
          weeklyClasses: cs.weekly_classes
        }))
    }));

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

    const systemPrompt = `Você é um sistema especializado em criar horários escolares.
Sua tarefa é criar um horário escolar otimizado respeitando as restrições.

REGRAS CRÍTICAS:
1. Um professor NÃO pode ter duas aulas no mesmo horário
2. Uma turma NÃO pode ter duas aulas no mesmo horário
3. Respeitar a disponibilidade dos professores
4. Distribuir as aulas de cada disciplina ao longo da semana (evitar 2 aulas seguidas da mesma disciplina, exceto se necessário)
5. Priorizar o início do dia para disciplinas mais complexas (Matemática, Português)

Formato de resposta: JSON array com objetos contendo:
{ "classId": "id", "subjectName": "nome", "teacherId": "id|null", "dayOfWeek": 1-5, "periodNumber": 1-6 }

Dias: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta
Períodos: 1 ao ${periodsPerDay}`;

    const userPrompt = `Crie o horário para as seguintes turmas:

TURMAS E DISCIPLINAS:
${JSON.stringify(classInfo, null, 2)}

PROFESSORES DISPONÍVEIS:
${JSON.stringify(teacherInfo, null, 2)}

REGRAS PEDAGÓGICAS ATIVAS:
${JSON.stringify(activeRules, null, 2)}

SLOTS JÁ OCUPADOS (não usar):
${JSON.stringify(Array.from(occupiedSlots.keys()), null, 2)}

DISPONIBILIDADE DOS PROFESSORES (formato: teacherId-dia-periodo = disponível):
${JSON.stringify(Object.fromEntries(availabilityMap), null, 2)}

Gere APENAS o JSON array com as aulas. Nenhum texto adicional.`;

    console.log('Calling AI for timetable generation...');

    // Call Lovable AI Gateway
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
        max_tokens: 8000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos no Lovable.');
      }
      throw new Error('Erro ao gerar horário com IA');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response received, parsing...');

    // Parse the AI response - extract JSON from the content
    let generatedEntries: TimetableEntry[] = [];
    try {
      // Strip markdown code fences if present (```json ... ```)
      const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      // Try to find JSON array in the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        generatedEntries = parsed.map((e: Record<string, unknown>) => ({
          class_id: e.classId as string,
          subject_name: e.subjectName as string,
          teacher_id: e.teacherId as string | null,
          day_of_week: e.dayOfWeek as number,
          period_number: e.periodNumber as number,
          is_locked: false
        }));
      } else {
        throw new Error('JSON não encontrado na resposta');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Validate and filter entries
    const validEntries = generatedEntries.filter(e => 
      e.class_id && 
      e.subject_name && 
      e.day_of_week >= 1 && 
      e.day_of_week <= daysPerWeek &&
      e.period_number >= 1 && 
      e.period_number <= periodsPerDay &&
      !occupiedSlots.has(`${e.class_id}-${e.day_of_week}-${e.period_number}`)
    );

    // Delete non-locked entries for selected classes
    await supabase
      .from('timetable_entries')
      .delete()
      .in('class_id', classIds)
      .eq('is_locked', false);

    // Insert new entries
    if (validEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('timetable_entries')
        .insert(validEntries);
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Erro ao salvar horário no banco');
      }
    }

    // Calculate quality score
    let conflictsCount = 0;
    const teacherSlots = new Map<string, number>();
    const classSlots = new Map<string, number>();
    
    [...lockedEntries, ...validEntries].forEach(e => {
      if (e.teacher_id) {
        const teacherKey = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        teacherSlots.set(teacherKey, (teacherSlots.get(teacherKey) || 0) + 1);
      }
      const classKey = `${e.class_id}-${e.day_of_week}-${e.period_number}`;
      classSlots.set(classKey, (classSlots.get(classKey) || 0) + 1);
    });

    teacherSlots.forEach(count => { if (count > 1) conflictsCount++; });
    classSlots.forEach(count => { if (count > 1) conflictsCount++; });

    const qualityScore = Math.max(0, 100 - (conflictsCount * 10));

    // Save to history
    await supabase.from('timetable_generation_history').insert({
      quality_score: qualityScore,
      conflicts_count: conflictsCount,
      status: conflictsCount === 0 ? 'success' : 'warning',
      explanation: `Horário gerado com ${validEntries.length} aulas. ${conflictsCount} conflitos encontrados.`,
      snapshot: { entries: validEntries, lockedEntries }
    });

    console.log(`Timetable generated: ${validEntries.length} entries, ${conflictsCount} conflicts, score: ${qualityScore}`);

    return new Response(JSON.stringify({
      success: true,
      entriesCount: validEntries.length,
      conflictsCount: conflictsCount,
      qualityScore,
      explanation: conflictsCount === 0 
        ? `Horário gerado com sucesso! ${validEntries.length} aulas alocadas sem conflitos.`
        : `Horário gerado com ${validEntries.length} aulas. ${conflictsCount} conflitos precisam de revisão manual.`
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
