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
  // Altas habilidades / superdotação
  'Demonstra interesse intenso por jogos de lógica, xadrez e desafios estratégicos.',
  'Aprecia atividades desafiadoras que exigem raciocínio avançado.',
  'Mostra curiosidade investigativa por temas científicos e filosóficos.',
  'Cria projetos próprios, inventos ou histórias de forma autônoma.',
  'Realiza leituras acima do esperado para a faixa etária.',
  'Domina rapidamente novos conteúdos com pouca repetição.',
  'Demonstra liderança natural em trabalhos em grupo.',
  'Apresenta produções artísticas ou textuais de alta qualidade para a idade.',
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
  'Dificuldade na memória de trabalho (esquece instruções recém-dadas).',
  'Dificuldade na resolução de problemas que envolvem múltiplas etapas.',
  'Lentidão no processamento de informações verbais e/ou visuais.',
  'Dificuldade na expressão escrita (estruturação de frases e parágrafos).',
  'Dificuldade no reconhecimento e produção de fonemas (consciência fonológica).',
  'Dificuldade em manter postura adequada durante as atividades.',
  'Baixa tolerância à frustração diante de erros ou correções.',
  'Dificuldade no uso funcional do tempo (noção de antes, agora, depois).',
  'Dificuldade em compreender metáforas, ironias e linguagem figurada.',
  'Esquiva de atividades acadêmicas por sentimento de incapacidade.',
  'Dificuldade no controle de impulsos e espera da vez.',
  'Necessidade frequente de validação para iniciar tarefas.',
  'Desmotivação por falta de desafio (em casos de altas habilidades).',
  'Dispersão em ambientes com muitos estímulos simultâneos.',
  'Dificuldade na transferência de conhecimentos entre disciplinas.',
  'Resistência ao uso de materiais escritos (caderno, lápis).',
  'Ansiedade que interfere no desempenho escolar.',
  'Dificuldade na interação social com pares e adultos.',
  'Falta de acompanhamento familiar nas tarefas escolares.',
  'Insegurança e baixa autoestima diante das atividades.',
  'Episódios de crise emocional em sala de aula.',
];

// Sugestões específicas para alunos com altas habilidades / superdotação
export const HIGH_ABILITIES_FUNCTIONAL_SUGGESTIONS = [
  'Apresenta memória excepcional para fatos, datas e detalhes.',
  'Demonstra raciocínio lógico avançado para a faixa etária.',
  'Utiliza vocabulário rebuscado e preciso em diferentes contextos.',
  'Elabora estratégias próprias e criativas na resolução de problemas.',
  'Aprende novos conteúdos com poucas repetições.',
  'Faz conexões inusitadas entre diferentes áreas do conhecimento.',
  'Demonstra interesse por temas complexos e abstratos.',
  'Apresenta curiosidade investigativa intensa e persistente.',
  'Possui alta capacidade de concentração em temas de interesse.',
  'Produz textos, desenhos ou cálculos acima da média da turma.',
];

export const HIGH_ABILITIES_POTENTIALITIES_SUGGESTIONS = [
  'Beneficia-se de jogos e atividades desafiadoras (xadrez, lógica, programação).',
  'Engaja-se em projetos investigativos de longa duração.',
  'Tem facilidade para liderar e mediar grupos de trabalho.',
  'Aproveita atividades de aprofundamento em temas de interesse.',
  'Beneficia-se de desafios matemáticos e olimpíadas científicas.',
  'Apresenta produção criativa em escrita, arte ou música.',
  'Aproveita oportunidades de mentoria e troca com pares avançados.',
  'Demonstra autonomia em pesquisa e estudo independente.',
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
  // Altas habilidades / superdotação
  {
    objetivo: 'Aprofundar conteúdos em área de interesse específico.',
    estrategia: 'Projetos investigativos individuais e estudos avançados.',
    frequencia: 'Semanal',
    responsavel: 'Professor AEE',
    recurso: 'Livros, artigos e recursos digitais avançados',
  },
  {
    objetivo: 'Estimular pensamento crítico e criativo.',
    estrategia: 'Desafios lógicos, xadrez e jogos estratégicos.',
    frequencia: 'Semanal',
    responsavel: 'Professor AEE',
    recurso: 'Xadrez, jogos de lógica, plataformas online',
  },
  {
    objetivo: 'Promover liderança e protagonismo.',
    estrategia: 'Mediação de grupos e apresentação de projetos próprios.',
    frequencia: 'Quinzenal',
    responsavel: 'Professor regente / AEE',
    recurso: 'Espaço de apresentação e materiais multimídia',
  },
  {
    objetivo: 'Ampliar repertório cultural e científico.',
    estrategia: 'Clubes de leitura, olimpíadas científicas e feiras.',
    frequencia: 'Mensal',
    responsavel: 'Professor AEE / Coordenação',
    recurso: 'Editais de olimpíadas, livros e laboratório',
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
  'Enunciados simples, curtos e diretos, sem duplo sentido.',
  'Fonte ampliada (mínimo 16pt) em todas as provas e atividades.',
  'Espaçamento maior entre questões para facilitar a leitura.',
];

// Sugestões de adaptações para alunos com altas habilidades / superdotação
export const ADAPTATION_HIGH_ABILITIES_SUGGESTIONS = [
  'Atividades de aprofundamento e enriquecimento curricular.',
  'Projetos de pesquisa autônoma sobre temas de interesse.',
  'Desafios extras de raciocínio lógico e resolução de problemas.',
  'Acesso a materiais avançados (livros, vídeos, artigos científicos).',
  'Participação em olimpíadas científicas, matemáticas e concursos.',
  'Tarefas abertas que estimulem criatividade e originalidade.',
  'Possibilidade de avanço para conteúdos de séries posteriores.',
  'Mentoria com especialistas ou estudantes mais avançados.',
];
