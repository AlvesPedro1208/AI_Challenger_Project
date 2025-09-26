// frontend/src/utils/logViewer.ts
import { logger, VideoUploadLogger } from './logger';

export class LogViewer {
  /**
   * Exibe todos os logs no console de forma organizada
   */
  static displayAllLogs() {
    console.group('📊 LOGS DO SISTEMA DE UPLOAD');
    
    const logs = logger.getLogs();
    
    if (logs.length === 0) {
      console.log('ℹ️ Nenhum log encontrado');
      console.groupEnd();
      return;
    }
    
    // Agrupar logs por categoria
    const logsByCategory = logs.reduce((acc, log) => {
      if (!acc[log.category]) {
        acc[log.category] = [];
      }
      acc[log.category].push(log);
      return acc;
    }, {} as Record<string, typeof logs>);
    
    // Exibir logs por categoria
    Object.entries(logsByCategory).forEach(([category, categoryLogs]) => {
      console.group(`📁 ${category} (${categoryLogs.length} logs)`);
      
      categoryLogs.forEach(log => {
        const emoji = this.getEmojiForLevel(log.level);
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        
        console.log(`${emoji} [${timestamp}] ${log.message}`);
        
        if (log.data && Object.keys(log.data).length > 0) {
          console.log('   📋 Dados:', log.data);
        }
      });
      
      console.groupEnd();
    });
    
    console.groupEnd();
  }
  
  /**
   * Exibe estatísticas dos logs
   */
  static displayLogStats() {
    const logs = logger.getLogs();
    
    console.group('📈 ESTATÍSTICAS DOS LOGS');
    
    // Contagem por nível
    const levelCounts = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Logs por nível:');
    Object.entries(levelCounts).forEach(([level, count]) => {
      const emoji = this.getEmojiForLevel(level);
      console.log(`   ${emoji} ${level}: ${count}`);
    });
    
    // Contagem por categoria
    const categoryCounts = logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📁 Logs por categoria:');
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`   📂 ${category}: ${count}`);
    });
    
    // Período dos logs
    if (logs.length > 0) {
      const firstLog = new Date(Math.min(...logs.map(l => l.timestamp)));
      const lastLog = new Date(Math.max(...logs.map(l => l.timestamp)));
      const duration = lastLog.getTime() - firstLog.getTime();
      
      console.log(`⏱️ Período: ${firstLog.toLocaleTimeString()} - ${lastLog.toLocaleTimeString()}`);
      console.log(`⏳ Duração: ${(duration / 1000).toFixed(2)}s`);
    }
    
    console.groupEnd();
  }
  
  /**
   * Filtra e exibe logs de erro
   */
  static displayErrorLogs() {
    const errorLogs = logger.getLogs().filter(log => log.level === 'ERROR');
    
    console.group('🚨 LOGS DE ERRO');
    
    if (errorLogs.length === 0) {
      console.log('✅ Nenhum erro encontrado!');
    } else {
      errorLogs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        console.error(`🚨 [${timestamp}] ${log.category}: ${log.message}`);
        
        if (log.data) {
          console.error('   📋 Detalhes:', log.data);
        }
      });
    }
    
    console.groupEnd();
  }
  
  /**
   * Exibe logs de upload de vídeo
   */
  static displayVideoUploadLogs() {
    const videoLogs = logger.getLogs().filter(log => 
      log.category.includes('VIDEO') || 
      log.category.includes('UPLOAD') ||
      log.category.includes('VALIDATION')
    );
    
    console.group('🎥 LOGS DE UPLOAD DE VÍDEO');
    
    if (videoLogs.length === 0) {
      console.log('ℹ️ Nenhum log de upload encontrado');
    } else {
      videoLogs.forEach(log => {
        const emoji = this.getEmojiForLevel(log.level);
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        
        console.log(`${emoji} [${timestamp}] ${log.category}: ${log.message}`);
        
        if (log.data) {
          console.log('   📋 Dados:', log.data);
        }
      });
    }
    
    console.groupEnd();
  }
  
  /**
   * Exporta logs para download
   */
  static exportLogs() {
    const logs = logger.getLogs();
    const exportData = {
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📥 Logs exportados com sucesso!');
  }
  
  /**
   * Limpa todos os logs
   */
  static clearLogs() {
    logger.clearLogs();
    console.log('🧹 Todos os logs foram limpos!');
  }
  
  private static getEmojiForLevel(level: string): string {
    switch (level) {
      case 'ERROR': return '🚨';
      case 'WARN': return '⚠️';
      case 'INFO': return 'ℹ️';
      case 'DEBUG': return '🔍';
      default: return '📝';
    }
  }
}

// Adicionar comandos globais para facilitar o debug
declare global {
  interface Window {
    logViewer: typeof LogViewer;
    logs: () => any[];
    showLogs: () => void;
    showStats: () => void;
    showErrors: () => void;
    showVideoLogs: () => void;
    exportLogs: () => void;
    clearLogs: () => void;
  }
}

// Disponibilizar globalmente para debug
if (typeof window !== 'undefined') {
  window.logViewer = LogViewer;
  window.showLogs = () => LogViewer.displayAllLogs();
  window.showStats = () => LogViewer.displayLogStats();
  window.showErrors = () => LogViewer.displayErrorLogs();
  window.showVideoLogs = () => LogViewer.displayVideoUploadLogs();
  window.exportLogs = () => LogViewer.exportLogs();
  window.clearLogs = () => LogViewer.clearLogs();
  
  // Comando específico para teste
  window.logs = () => {
    console.log('📋 Logs disponíveis:', logger.getLogs().length);
    return logger.getLogs();
  };
  
  // Comando de teste simples
  window.test = () => {
    console.log('✅ Teste funcionando!');
    console.log('📊 Logger disponível:', typeof logger);
    console.log('📋 Logs:', logger.getLogs().length);
    return 'OK';
  };
  
  // Comandos numerados para facilitar (usando nomes válidos)
  (window as any).cmd1 = () => {
    try {
      LogViewer.displayAllLogs();
    } catch (error) {
      console.error('Erro no comando 1:', error);
    }
  };
  (window as any).cmd2 = () => {
    try {
      LogViewer.displayLogStats();
    } catch (error) {
      console.error('Erro no comando 2:', error);
    }
  };
  (window as any).cmd3 = () => {
    try {
      LogViewer.displayErrorLogs();
    } catch (error) {
      console.error('Erro no comando 3:', error);
    }
  };
  (window as any).cmd4 = () => {
    try {
      console.log('🎥 Executando comando 4 - Logs de upload de vídeo...');
      LogViewer.displayVideoUploadLogs();
    } catch (error) {
      console.error('❌ Erro no comando 4:', error);
      console.error('Stack trace:', error.stack);
    }
  };
  (window as any).cmd5 = () => {
    try {
      LogViewer.exportLogs();
    } catch (error) {
      console.error('Erro no comando 5:', error);
    }
  };
  (window as any).cmd6 = () => {
    try {
      LogViewer.clearLogs();
    } catch (error) {
      console.error('Erro no comando 6:', error);
    }
  };
  
  console.log('🔧 LogViewer carregado! Use os comandos:');
  console.log('   test() - Teste básico do sistema');
  console.log('   logs() - Mostrar quantidade de logs');
  console.log('   cmd1() ou showLogs() - Exibir todos os logs');
  console.log('   cmd2() ou showStats() - Exibir estatísticas');
  console.log('   cmd3() ou showErrors() - Exibir apenas erros');
  console.log('   cmd4() ou showVideoLogs() - Exibir logs de upload');
  console.log('   cmd5() ou exportLogs() - Exportar logs');
  console.log('   cmd6() ou clearLogs() - Limpar logs');
}