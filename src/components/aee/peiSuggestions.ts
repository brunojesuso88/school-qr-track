export const FUNCTIONAL_PROFILE_SUGGESTIONS = [
  'Apresenta atenção sustentada por períodos curtos, beneficiando-se de pausas frequentes.',
  'Demonstra preferência por aprendizagem visual, com apoio de imagens e pictogramas.',
  'Comunica-se predominantemente por linguagem oral funcional, com vocabulário restrito.',
  'Utiliza comunicação alternativa (gestos, pranchas, PECS) para expressar necessidades.',
  'Apresenta hipersensibilidade auditiva, reagindo a ruídos intensos.',
  'Demonstra autonomia nas atividades de vida diária dentro do ambiente escolar.',
  'Necessita de mediação constante para iniciar e concluir tarefas.',
  'Aprende melhor por meio de atividades concretas e manipuláveis.',
  'Apresenta ritmo de aprendizagem mais lento, exigindo repetição e revisão constantes.',
  'Demonstra raciocínio lógico preservado em situações estruturadas.',
  'Tem dificuldade em generalizar conceitos para novos contextos.',
  'Apresenta boa memória visual e auditiva para temas de interesse.',
  'Responde positivamente a comandos simples e diretos.',
  'Apresenta estilo cognitivo predominantemente prático e experiencial.',
];

export const POTENTIALITIES_SUGGESTIONS = [
  'Demonstra interesse por música e atividades rítmicas.',
  'Possui boa memória para informações de seu interesse.',
  'Apresenta habilidade artística (desenho, pintura, modelagem).',
  'Participa com entusiasmo de atividades em grupo quando bem mediadas.',
  'Demonstra empatia e cuidado com colegas.',
  'Apresenta facilidade com tecnologia e recursos digitais.',
  'Realiza atividades motoras amplas com destreza.',
  'Demonstra raciocínio matemático em situações concretas.',
  'Reconhece e nomeia letras e/ou números (alfabetização inicial).',
  'Demonstra criatividade na resolução de problemas práticos.',
  'Tem boa coordenação motora fina.',
  'Apresenta vocabulário rico em temas de interesse específico.',
  'Demonstra interesse por leitura e contação de histórias.',
  'Possui senso de humor e interage de forma afetiva.',
];

export const LEARNING_BARRIERS_SUGGESTIONS = [
  'Dificuldade na manutenção da atenção em atividades longas.',
  'Dificuldade em interpretação de enunciados textuais.',
  'Dificuldade em interação social com pares e adultos.',
  'Resistência a mudanças de rotina e atividades não previstas.',
  'Dificuldade na coordenação motora fina (escrita, recorte).',
  'Dificuldade na organização espacial e temporal.',
  'Comportamento desafiador em situações de frustração.',
  'Dificuldade na compreensão de regras sociais implícitas.',
  'Limitação no vocabulário expressivo.',
  'Dificuldade em abstração e raciocínio simbólico.',
  'Hipersensibilidade sensorial (sons, luzes, texturas).',
  'Dificuldade em copiar do quadro / atividades visuais distantes.',
  'Dificuldade na consolidação da leitura e escrita.',
  'Dificuldade no raciocínio lógico-matemático abstrato.',
];

export interface InterventionSuggestion {
  objetivo: string;
  estrategia: string;
  frequencia?: string;
  responsavel?: string;
  recurso?: string;
}

export const INTERVENTION_PLAN_SUGGESTIONS: InterventionSuggestion[] = [
  {
    objetivo: 'Ampliar o tempo de atenção em atividades dirigidas.',
    estrategia: 'Uso de cronômetro visual e divisão da atividade em pequenas etapas.',
    frequencia: 'Diária',
    responsavel: 'Professor regente / AEE',
    recurso: 'Cronômetro visual, fichas de tarefa',
  },
  {
    objetivo: 'Desenvolver a comunicação funcional.',
    estrategia: 'Uso de pranchas de comunicação alternativa e modelagem verbal.',
    frequencia: 'Diária',
    responsavel: 'Professor AEE',
    recurso: 'Pranchas PECS, pictogramas',
  },
  {
    objetivo: 'Avançar no processo de alfabetização.',
    estrategia: 'Atividades com método fônico e materiais concretos (alfabeto móvel).',
    frequencia: '3x por semana',
    responsavel: 'Professor regente',
    recurso: 'Alfabeto móvel, jogos de letras',
  },
  {
    objetivo: 'Desenvolver autonomia nas atividades de vida diária.',
    estrategia: 'Rotina visual com pictogramas e reforço positivo.',
    frequencia: 'Diária',
    responsavel: 'Família e equipe escolar',
    recurso: 'Quadro de rotina, pictogramas',
  },
  {
    objetivo: 'Ampliar o repertório de interação social.',
    estrategia: 'Histórias sociais e jogos cooperativos mediados.',
    frequencia: 'Semanal',
    responsavel: 'Professor AEE',
    recurso: 'Histórias sociais, jogos de tabuleiro',
  },
  {
    objetivo: 'Desenvolver coordenação motora fina.',
    estrategia: 'Atividades de recorte, pinça, traçado e modelagem com massinha.',
    frequencia: 'Diária',
    responsavel: 'Professor regente',
    recurso: 'Tesoura, massinha, lápis triangular',
  },
  {
    objetivo: 'Compreender enunciados de problemas matemáticos.',
    estrategia: 'Leitura compartilhada e uso de material dourado/concreto.',
    frequencia: '2x por semana',
    responsavel: 'Professor regente',
    recurso: 'Material dourado, ábaco',
  },
  {
    objetivo: 'Reduzir comportamentos disruptivos em sala.',
    estrategia: 'Antecipação de rotina, espaço de auto-regulação e reforço positivo.',
    frequencia: 'Diária',
    responsavel: 'Professor regente / AEE',
    recurso: 'Cantinho da calma, agenda visual',
  },
  {
    objetivo: 'Ampliar a leitura e interpretação textual.',
    estrategia: 'Textos curtos com apoio de imagens e perguntas guiadas.',
    frequencia: 'Semanal',
    responsavel: 'Professor regente',
    recurso: 'Textos adaptados, imagens',
  },
  {
    objetivo: 'Desenvolver raciocínio lógico-matemático.',
    estrategia: 'Jogos de tabuleiro adaptados e situações-problema concretas.',
    frequencia: 'Semanal',
    responsavel: 'Professor AEE',
    recurso: 'Jogos pedagógicos',
  },
];

export const ADAPTATION_PORTUGUES_HUMANAS_SUGGESTIONS = [
  'Textos curtos com vocabulário acessível.',
  'Fonte ampliada (14 a 16 pt) e espaçamento maior entre linhas.',
  'Apoio de imagens e ilustrações para favorecer a compreensão.',
  'Leitura compartilhada e mediada pelo professor.',
  'Redução do número de questões mantendo o conteúdo essencial.',
  'Uso de áudio-livros e recursos sonoros como apoio.',
  'Aceitação de respostas orais ou por desenho quando a escrita for limitada.',
  'Uso de tarjas de leitura para auxiliar no acompanhamento das linhas.',
];

export const ADAPTATION_MATEMATICA_EXATAS_SUGGESTIONS = [
  'Uso de material concreto (material dourado, ábaco, tampinhas).',
  'Calculadora autorizada quando necessário.',
  'Tempo ampliado (50% a mais) para realização das atividades.',
  'Uso de cores para destacar operações e sinais.',
  'Problemas contextualizados ao cotidiano do estudante.',
  'Redução da quantidade de exercícios mantendo a qualidade.',
  'Tabela de fatos básicos (adição, multiplicação) como apoio.',
  'Quadriculados e grades para organização das contas.',
];

export const ADAPTATION_CIENCIAS_HUMANAS_SUGGESTIONS = [
  'Linha do tempo visual para conteúdos históricos.',
  'Mapas com cores e legendas simplificadas.',
  'Vídeos curtos como apoio à explicação.',
  'Vocabulário simplificado e glossário ilustrado.',
  'Atividades práticas e experiências concretas.',
  'Sínteses em mapa mental ao final de cada unidade.',
  'Roteiros de estudo com tópicos destacados.',
  'Trabalhos em dupla ou pequenos grupos com mediação.',
];

export const EVALUATION_CRITERIA_SUGGESTIONS = [
  'Avaliação processual e contínua, considerando avanços individuais.',
  'Provas adaptadas com fonte ampliada e enunciados simplificados.',
  'Tempo adicional (50%) para realização das atividades avaliativas.',
  'Avaliação oral como complemento à escrita.',
  'Uso de portfólio de produções como instrumento avaliativo.',
  'Critério de sucesso: realização da atividade com apoio do mediador.',
  'Critério de sucesso: realização da atividade de forma independente.',
  'Avaliação por meio de registros fotográficos e relatórios descritivos.',
  'Considerar participação, esforço e evolução em relação a si mesmo.',
  'Adaptação significativa do conteúdo (currículo funcional).',
  'Aplicação da prova em ambiente reservado e silencioso.',
  'Permissão de uso de materiais de apoio (tabuada, glossário).',
];
