// Serviço para consumir APIs dos KPIs do backend
const API_BASE_URL = 'http://localhost:8000';

export interface KPIOverview {
  total_clientes: number;
  taxa_conversao: number;
  propensao_alta: number;
  tempo_medio_horas: number;
}

export interface BehaviorData {
  action: string;
  count: number;
}

export interface PropensityData {
  label: string;
  value: number;
  percentage: number;
}

export interface HeatmapData {
  x: number;
  y: number;
  intensity: number;
}

export interface APIResponse<T> {
  data?: T;
}

class KPIService {
  private async fetchAPI<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados de ${endpoint}:`, error);
      throw error;
    }
  }

  async getKPIOverview(): Promise<KPIOverview> {
    return this.fetchAPI<KPIOverview>('/kpis/overview');
  }

  async getBehaviorAnalysis(): Promise<BehaviorData[]> {
    const response = await this.fetchAPI<APIResponse<BehaviorData[]>>('/kpis/behavior-analysis');
    return response.data || [];
  }

  async getPropensityDistribution(): Promise<PropensityData[]> {
    const response = await this.fetchAPI<APIResponse<PropensityData[]>>('/kpis/propensity-distribution');
    return response.data || [];
  }

  async getHeatmapData(): Promise<HeatmapData[]> {
    const response = await this.fetchAPI<APIResponse<HeatmapData[]>>('/kpis/heatmap-data');
    return response.data || [];
  }
}

export const kpiService = new KPIService();