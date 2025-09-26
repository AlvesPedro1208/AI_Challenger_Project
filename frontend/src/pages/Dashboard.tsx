import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3,
  Download,
  RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import HeatmapVisualization from "@/components/HeatmapVisualization";
import { kpiService, KPIOverview, BehaviorData, PropensityData } from "@/services/kpiService";
import { useState, useEffect } from "react";

const Dashboard = () => {
  const [kpiOverview, setKpiOverview] = useState<KPIOverview | null>(null);
  const [behaviorData, setBehaviorData] = useState<BehaviorData[]>([]);
  const [propensityData, setPropensityData] = useState<PropensityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [overview, behavior, propensity] = await Promise.all([
        kpiService.getKPIOverview(),
        kpiService.getBehaviorAnalysis(),
        kpiService.getPropensityDistribution()
      ]);

      setKpiOverview(overview);
      setBehaviorData(behavior.sort((a, b) => b.count - a.count));
      setPropensityData(propensity);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Configurar atualização automática a cada 30 segundos
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    // Cleanup do interval quando o componente for desmontado
    return () => clearInterval(interval);
  }, []);

  const formatTime = (hours: number) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const overviewMetrics = kpiOverview ? [
    {
      title: "Total de Clientes",
      value: kpiOverview.total_clientes.toLocaleString(),
      change: "+12.5%",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Taxa de Conversão",
      value: `${kpiOverview.taxa_conversao}%`,
      change: "+2.1%",
      icon: ShoppingCart,
      color: "text-success",
    },
    {
      title: "Propensão Alta",
      value: kpiOverview.propensao_alta.toString(),
      change: "+8.3%",
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      title: "Tempo Total Analisado",
      value: formatTime(kpiOverview.tempo_medio_horas),
      change: "-0.5%",
      icon: Clock,
      color: "text-warning",
    },
  ] : [];

  // Função para calcular a opacidade baseada no valor
  const getBarOpacity = (value: number, maxValue: number) => {
    const minOpacity = 0.3;
    const maxOpacity = 1.0;
    const ratio = value / maxValue;
    return minOpacity + (maxOpacity - minOpacity) * ratio;
  };

  const maxBehaviorValue = Math.max(...behaviorData.map(item => item.count));

  const COLORS = ['#01c38e', '#ff9500', '#8b9dc3'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando dados do dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-display">Dashboard de Métricas</h1>
          <p className="text-muted-foreground mt-1 font-body">
            Visão geral do comportamento dos clientes em tempo real
            {lastUpdate && (
              <span className="ml-2 text-xs">
                • Última atualização: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {overviewMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} className="bg-gradient-card shadow-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground font-tech">
                  {metric.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-display">{metric.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge 
                    variant={metric.change.startsWith('+') ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {metric.change}
                  </Badge>
                  <span className="text-xs text-muted-foreground">vs. período anterior</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Behavior Analysis */}
        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display">
              <BarChart3 className="h-5 w-5 text-primary" />
              Análise de Comportamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={behaviorData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="action" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                    fill="#01c38e"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Propension Analysis */}
        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display">
              <Target className="h-5 w-5 text-accent" />
              Distribuição de Propensão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={propensityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ label, value, percentage }) => 
                      `${label}: ${value} (${percentage}%)`
                    }
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    fontSize={14}
                    fontWeight="500"
                  >
                    {propensityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: '14px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Visualization - Full Width */}
      <div className="w-full">
        <HeatmapVisualization />
      </div>

      {/* Analytics Cards - All in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-display">Produtos Mais Interagidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Arroz", "Peito de Frango", "Pano de Prato", "Banana"].map((product, index) => (
                <div key={product} className="flex justify-between items-center">
                  <span className="text-sm">{product}</span>
                  <Badge variant="secondary">{145 - index * 20}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-display">ROIs Mais Visitadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Grãos", "Açougue", "Casa & Jardim", "Verduras"].map((roi, index) => (
                <div key={roi} className="flex justify-between items-center">
                  <span className="text-sm">{roi}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${85 - index * 15}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{85 - index * 15}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-display">Tempo por Seção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { section: "Entrada", time: "2m 15s" },
                { section: "Produtos", time: "8m 42s" },
                { section: "Caixa", time: "1m 35s" },
                { section: "Saída", time: "0m 45s" }
              ].map((item) => (
                <div key={item.section} className="flex justify-between items-center">
                  <span className="text-sm">{item.section}</span>
                  <Badge variant="outline">{item.time}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-display">Métricas Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { metric: "Taxa de Rejeição", value: "12.3%" },
                { metric: "Tempo Médio no Estabelecimento", value: "4m 32s" },
                { metric: "Conversões", value: "187" },
                { metric: "Satisfação", value: "94%" }
              ].map((item) => (
                <div key={item.metric} className="flex justify-between items-center">
                  <span className="text-sm">{item.metric}</span>
                  <Badge variant="outline">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;