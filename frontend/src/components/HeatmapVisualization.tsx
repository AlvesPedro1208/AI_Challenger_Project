import React, { useState } from "react";
import { Thermometer } from "lucide-react";

const HeatmapVisualization: React.FC = () => {
  // Configurações do mapa de calor
  const GRID_WIDTH = 75;  // Largura: 75 quadradinhos
  const GRID_HEIGHT = 25; // Altura: 25 quadradinhos
  const TOTAL_CELLS = GRID_WIDTH * GRID_HEIGHT; // 1.875 quadradinhos

  // Função para gerar dados simulados do mapa de calor
  const generateHeatmapData = () => {
    const data = [];
    
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        let intensity = Math.random() * 0.3; // Base baixa
        
        // Área de entrada (canto superior esquerdo) - mais tráfego
        if (row < 6 && col < 12) {
          intensity += Math.random() * 0.4 + 0.3;
        }
        
        // Corredores principais (linhas horizontais e verticais)
        if (row === 12 || row === 13 || col === 25 || col === 50) {
          intensity += Math.random() * 0.3 + 0.2;
        }
        
        // Área de eletrônicos (região central-direita)
        if (row >= 8 && row <= 18 && col >= 45 && col <= 65) {
          intensity += Math.random() * 0.5 + 0.4;
        }
        
        // Área de roupas (região central-esquerda)
        if (row >= 8 && row <= 18 && col >= 10 && col <= 35) {
          intensity += Math.random() * 0.4 + 0.3;
        }
        
        // Caixas (parte inferior)
        if (row >= 20 && col >= 20 && col <= 55) {
          intensity += Math.random() * 0.6 + 0.5;
        }
        
        // Limitar intensidade máxima
        intensity = Math.min(intensity, 1);
        
        data.push({
          x: col,
          y: row,
          value: intensity,
          visitors: Math.floor(intensity * 100 + Math.random() * 20)
        });
      }
    }
    
    return data;
  };

  const [heatmapData] = useState(generateHeatmapData);

  // Função para obter a cor baseada na intensidade - usando classes que respondem ao tema
  const getColor = (intensity: number) => {
    if (intensity < 0.2) return 'bg-blue-500 dark:bg-blue-700';      // Azul
    if (intensity < 0.4) return 'bg-cyan-500 dark:bg-cyan-700';      // Ciano
    if (intensity < 0.6) return 'bg-yellow-500 dark:bg-yellow-600';  // Amarelo
    if (intensity < 0.8) return 'bg-orange-500 dark:bg-orange-600';  // Laranja
    return 'bg-red-500 dark:bg-red-600';                             // Vermelho
  };

  return (
    <div className="bg-gradient-card shadow-card border border-border/50 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-display">Mapa de Calor - Tráfego</h3>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>Hoje, 14h</span>
          <span>Tempo Real</span>
        </div>
      </div>
      
      {/* Grid do mapa de calor com cantos arredondados */}
      <div className="relative mb-4">
        <div className={`grid grid-cols-75 gap-0.5 max-w-full rounded-xl overflow-hidden border-2 border-border`}>
          {heatmapData.map((cell, index) => (
            <div
              key={index}
              className={`aspect-square ${getColor(cell.value)} hover:opacity-90 transition-all duration-200 cursor-pointer relative group border border-border/50`}
              title={`Posição: (${cell.x}, ${cell.y}) - ${cell.visitors} visitantes`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-border">
                {cell.visitors} visitantes
              </div>
            </div>
          ))}
        </div>
        
        {/* Labels das áreas */}
        <div className="absolute top-1/2 left-16 transform -translate-y-1/2 bg-popover/90 text-popover-foreground px-2 py-1 rounded text-xs border border-border">
          Grãos
        </div>
        <div className="absolute top-1/2 right-16 transform -translate-y-1/2 bg-popover/90 text-popover-foreground px-2 py-1 rounded text-xs border border-border">
          Açougue
        </div>
        <div className="absolute top-4 left-8 bg-popover/90 text-popover-foreground px-2 py-1 rounded text-xs border border-border">
          Entrada
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 dark:bg-blue-700 rounded border border-blue-400 dark:border-blue-500"></div>
            <span className="text-muted-foreground">Baixo</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-cyan-500 dark:bg-cyan-700 rounded border border-cyan-400 dark:border-cyan-500"></div>
            <span className="text-muted-foreground">Baixo-Médio</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 dark:bg-yellow-600 rounded border border-yellow-400 dark:border-yellow-500"></div>
            <span className="text-muted-foreground">Médio</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 dark:bg-orange-600 rounded border border-orange-400 dark:border-orange-500"></div>
            <span className="text-muted-foreground">Médio-Alto</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 dark:bg-red-600 rounded border border-red-400 dark:border-red-500"></div>
            <span className="text-muted-foreground">Alto</span>
          </div>
        </div>
        <div className="text-muted-foreground">
          Intensidade de tráfego por área da loja
        </div>
      </div>
    </div>
  );
};

export default HeatmapVisualization;