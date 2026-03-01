import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode, Users, BookOpen, Map, Clock, FileText, Bell, Smartphone, Shield, Brain } from "lucide-react";

interface AboutSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AboutSystemDialog = ({ open, onOpenChange }: AboutSystemDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Sobre o Sistema
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] px-6 pb-6">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-primary">EDUNEXUS</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema Digital de Secretaria Escolar
            </p>
            <Badge variant="outline" className="mt-2">Versão 1.0.0</Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Plataforma completa para gestão escolar digital, integrando controle de alunos, 
            frequência automatizada por QR Code, mapeamento de professores e turmas, 
            geração inteligente de horários com IA e muito mais.
          </p>

          <Accordion type="multiple" className="w-full">
            {/* 1. Gestão de Alunos */}
            <AccordionItem value="students">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Gestão de Alunos
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Cadastro completo com nome, data de nascimento, responsável e telefone</li>
                  <li>Geração automática de matrícula (ID) sequencial</li>
                  <li>Upload de foto do aluno com armazenamento seguro</li>
                  <li>QR Code individual gerado automaticamente para cada aluno</li>
                  <li>Importação em lote via PDF com extração inteligente por IA</li>
                  <li>Filtros por turma, turno e status (ativo/inativo)</li>
                  <li>Relatório individual do aluno com histórico completo</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Frequência por QR Code */}
            <AccordionItem value="attendance">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-success" />
                  Frequência por QR Code
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Leitura de QR Code via câmera do dispositivo (html5-qrcode)</li>
                  <li>Compatível com leitor USB Eyoyo (detecção automática)</li>
                  <li>Registro instantâneo com data e hora</li>
                  <li>Dashboard de frequência em tempo real por turma</li>
                  <li>Registro manual de presença/falta/justificativa</li>
                  <li>Gráficos e tendências de frequência por período</li>
                  <li>Validação: bloqueio de registros em finais de semana</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 3. AEE */}
            <AccordionItem value="aee">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  Atendimento Educacional Especializado (AEE)
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Registro de CID (código e descrição)</li>
                  <li>Controle de medicação (nome e uso)</li>
                  <li>Status de alfabetização do aluno</li>
                  <li>Atividades adaptadas e sugestões pedagógicas</li>
                  <li>Upload de laudo médico (PDF)</li>
                  <li>Painel dedicado com filtros e indicadores</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Mapeamento Escolar */}
            <AccordionItem value="mapping">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-amber-500" />
                  Mapeamento Escolar
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Cadastro de turmas com turno e carga horária semanal</li>
                  <li>Cadastro de disciplinas globais por turno</li>
                  <li>Cadastro de professores com cor, carga horária e disponibilidade</li>
                  <li>Importação de professores em lote via PDF com IA</li>
                  <li>Associação professor ↔ disciplina ↔ turma</li>
                  <li>Cálculo dinâmico de carga horária (sincronizado com banco)</li>
                  <li>Indicador de sobrecarga do professor</li>
                  <li>Resumo completo por professor e por turma</li>
                  <li>Exportação horizontal em PDF</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Geração de Horário com IA */}
            <AccordionItem value="timetable">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Geração de Horário com IA
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Geração automática de grade horária por inteligência artificial</li>
                  <li>3 níveis de rigor: Leve, Moderada e Rigorosa</li>
                  <li>Detecção automática de conflitos (professor em duas turmas)</li>
                  <li>Chat de conflitos com IA para resolução assistida</li>
                  <li>Grade interativa com drag-and-drop (dnd-kit)</li>
                  <li>Travamento de aulas fixas (is_locked)</li>
                  <li>Indicador de qualidade da grade gerada</li>
                  <li>Histórico de gerações com snapshot</li>
                  <li>Configuração de dias, horários e intervalos</li>
                  <li>Regras personalizáveis (distribuição, aulas geminadas, etc.)</li>
                  <li>Disponibilidade do professor por dia/horário</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 6. Ocorrências e Declarações */}
            <AccordionItem value="occurrences">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Ocorrências e Declarações
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Registro de ocorrências disciplinares por aluno</li>
                  <li>Tipos: advertência, suspensão, elogio, observação</li>
                  <li>Geração de declarações em PDF (matrícula, frequência, transferência)</li>
                  <li>Histórico completo vinculado ao aluno</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 7. Notificações */}
            <AccordionItem value="notifications">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-red-500" />
                  Notificações
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Notificações push via Service Worker (PWA)</li>
                  <li>Alerta de novo usuário cadastrado</li>
                  <li>Configuração de mensagens automáticas de ausência</li>
                  <li>Log de notificações enviadas</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 8. Segurança e Controle de Acesso */}
            <AccordionItem value="security">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Segurança e Controle de Acesso
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Autenticação com e-mail e senha</li>
                  <li>5 perfis de acesso: Admin, Direção, Professor, Funcionário, Usuário</li>
                  <li>Row Level Security (RLS) em todas as tabelas</li>
                  <li>Rotas protegidas por perfil de acesso</li>
                  <li>Log de auditoria (audit_logs) para rastreabilidade</li>
                  <li>URLs assinadas para fotos e documentos sensíveis</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 9. Tecnologias */}
            <AccordionItem value="tech">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-cyan-500" />
                  Tecnologias e Infraestrutura
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Frontend:</strong> React 18, TypeScript, Vite, Tailwind CSS</li>
                  <li><strong>UI:</strong> shadcn/ui, Radix UI, Framer Motion</li>
                  <li><strong>Backend:</strong> Lovable Cloud (Edge Functions em Deno)</li>
                  <li><strong>Banco de Dados:</strong> PostgreSQL com RLS</li>
                  <li><strong>IA:</strong> Google Gemini via Lovable AI Gateway</li>
                  <li><strong>PWA:</strong> Instalável em celulares e desktops</li>
                  <li><strong>PDF:</strong> jsPDF + jspdf-autotable para exportações</li>
                  <li><strong>QR Code:</strong> qrcode.react (geração) + html5-qrcode (leitura)</li>
                  <li><strong>Gráficos:</strong> Recharts para dashboards e relatórios</li>
                  <li><strong>Responsivo:</strong> Funciona em celulares, tablets e desktops</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Credits */}
          <div className="mt-6 pt-4 border-t text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Criado e desenvolvido por</p>
            <p className="text-sm text-primary font-bold">Bruno Oliveira</p>
            <p className="text-xs text-muted-foreground mt-2">
              © {new Date().getFullYear()} Edunexus - Todos os direitos reservados
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AboutSystemDialog;
