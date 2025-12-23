import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QrCode, Users, Calendar, Bell, ArrowRight, CheckCircle2, GraduationCap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: QrCode, title: 'Leitura de QR Code', description: 'Registro rápido com scanner USB ou câmera' },
    { icon: Users, title: 'Gestão de Alunos', description: 'Cadastro e geração automática de QR codes' },
    { icon: Calendar, title: 'Calendário Visual', description: 'Acompanhe padrões de frequência facilmente' },
    { icon: Bell, title: 'Alertas WhatsApp', description: 'Notificações automáticas de ausências' },
  ];

  return (
    <div className="min-h-screen gradient-hero">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">EDUNEXUS</span>
          </div>
          <Button onClick={() => navigate('/auth')}>
            Entrar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </nav>

        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Sistema Moderno de
            <span className="text-primary"> Controle de</span>
            <br />Frequência Escolar
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Simplifique o controle diário de presença com leitura de QR code, acompanhamento visual e notificações automáticas para responsáveis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')} className="text-base">
              Começar Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')} className="text-base">
              Ver Demonstração
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div key={feature.title} className="p-6 rounded-2xl bg-card border border-border/50 card-hover animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="mt-20 max-w-2xl mx-auto">
          <div className="p-8 rounded-2xl bg-card border border-border/50">
            <h2 className="text-xl font-semibold mb-6 text-center">Por que escolher o EDUNEXUS?</h2>
            <div className="space-y-4">
              {[
                'Compatível com scanners USB Eyoyo EY-024',
                'Geração automática de QR code para cada aluno',
                'Dashboard de frequência em tempo real',
                'Visualização colorida no calendário',
                'Autenticação segura para administradores',
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;