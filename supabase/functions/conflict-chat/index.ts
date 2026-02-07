import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch context data for the system prompt
    const [
      { data: teachers },
      { data: classes },
      { data: entries },
      { data: availability },
    ] = await Promise.all([
      supabase.from('mapping_teachers').select('id, name, max_weekly_hours, subjects'),
      supabase.from('mapping_classes').select('id, name, shift'),
      supabase.from('timetable_entries').select('*'),
      supabase.from('teacher_availability').select('*'),
    ]);

    // Build teacher workload summary
    const workloadMap = new Map<string, number>();
    (entries || []).forEach((e: { teacher_id: string | null }) => {
      if (e.teacher_id) workloadMap.set(e.teacher_id, (workloadMap.get(e.teacher_id) || 0) + 1);
    });

    const teacherSummary = (teachers || []).map((t: { id: string; name: string; max_weekly_hours: number; subjects: string[] | null }) => ({
      name: t.name,
      maxHours: t.max_weekly_hours,
      currentLoad: workloadMap.get(t.id) || 0,
      subjects: t.subjects || [],
    }));

    // Detect conflicts
    const teacherSlots = new Map<string, string[]>();
    (entries || []).forEach((e: { teacher_id: string | null; day_of_week: number; period_number: number; class_id: string; subject_name: string }) => {
      if (e.teacher_id) {
        const key = `${e.teacher_id}-${e.day_of_week}-${e.period_number}`;
        if (!teacherSlots.has(key)) teacherSlots.set(key, []);
        teacherSlots.get(key)!.push(`${e.class_id}:${e.subject_name}`);
      }
    });

    const conflictDetails: string[] = [];
    teacherSlots.forEach((slots, key) => {
      if (slots.length > 1) {
        const parts = key.split('-');
        const teacherId = parts.slice(0, 5).join('-');
        const day = parts[5];
        const period = parts[6];
        const teacher = (teachers || []).find((t: { id: string }) => t.id === teacherId);
        conflictDetails.push(`Professor "${teacher?.name || teacherId}" tem ${slots.length} aulas no dia ${day}, período ${period}: ${slots.join(', ')}`);
      }
    });

    const systemPrompt = `Você é um assistente especializado em horários escolares brasileiros. Seu papel é ajudar a resolver conflitos e otimizar horários.

CONTEXTO ATUAL DO SISTEMA:

PROFESSORES (${teacherSummary.length}):
${teacherSummary.map((t: { name: string; currentLoad: number; maxHours: number; subjects: string[] }) => 
  `- ${t.name}: ${t.currentLoad}/${t.maxHours}h, disciplinas: ${t.subjects.join(', ') || 'não definidas'}`
).join('\n')}

TURMAS (${(classes || []).length}):
${(classes || []).map((c: { name: string; shift: string }) => `- ${c.name} (${c.shift})`).join('\n')}

TOTAL DE AULAS ALOCADAS: ${(entries || []).length}

${conflictDetails.length > 0 ? `CONFLITOS DETECTADOS (${conflictDetails.length}):
${conflictDetails.join('\n')}` : 'NENHUM CONFLITO DETECTADO.'}

INSTRUÇÕES:
- Responda sempre em português brasileiro
- Seja específico e prático nas sugestões
- Use markdown para formatar respostas (negrito, listas, etc.)
- Quando sugerir trocas, indique exatamente quais professores e horários
- Considere a carga horária máxima dos professores
- Considere a disponibilidade dos professores`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Erro no gateway de IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('conflict-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
