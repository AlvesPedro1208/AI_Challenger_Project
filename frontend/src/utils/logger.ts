// Sistema de log detalhado para diagnóstico de upload de vídeos
export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Limite de logs para evitar vazamento de memória

  private createLogEntry(
    level: LogEntry['level'],
    category: string,
    message: string,
    data?: any,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      stack: error?.stack
    };
  }

  info(category: string, message: string, data?: any) {
    const entry = this.createLogEntry('INFO', category, message, data);
    this.addLog(entry);
    if (data) {
      console.log(`[${entry.timestamp}] [${category}] ${message}`, data);
    } else {
      console.log(`[${entry.timestamp}] [${category}] ${message}`);
    }
  }

  warn(category: string, message: string, data?: any) {
    const entry = this.createLogEntry('WARN', category, message, data);
    this.addLog(entry);
    if (data) {
      console.warn(`[${entry.timestamp}] [${category}] ${message}`, data);
    } else {
      console.warn(`[${entry.timestamp}] [${category}] ${message}`);
    }
  }

  error(category: string, message: string, data?: any, error?: Error) {
    const entry = this.createLogEntry('ERROR', category, message, data, error);
    this.addLog(entry);
    if (data && error) {
      console.error(`[${entry.timestamp}] [${category}] ${message}`, data, error);
    } else if (data) {
      console.error(`[${entry.timestamp}] [${category}] ${message}`, data);
    } else if (error) {
      console.error(`[${entry.timestamp}] [${category}] ${message}`, error);
    } else {
      console.error(`[${entry.timestamp}] [${category}] ${message}`);
    }
  }

  debug(category: string, message: string, data?: any) {
    const entry = this.createLogEntry('DEBUG', category, message, data);
    this.addLog(entry);
    if (data) {
      console.debug(`[${entry.timestamp}] [${category}] ${message}`, data);
    } else {
      console.debug(`[${entry.timestamp}] [${category}] ${message}`);
    }
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Manter apenas os últimos logs para evitar vazamento de memória
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  // Obter logs filtrados por categoria ou nível
  getLogs(filter?: { category?: string; level?: LogEntry['level']; since?: Date }) {
    let filteredLogs = [...this.logs];

    if (filter?.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filter.category);
    }

    if (filter?.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter?.since) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filter.since!);
    }

    return filteredLogs;
  }

  // Exportar logs como JSON para análise
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  // Limpar logs
  clearLogs() {
    this.logs = [];
    console.log('Logs limpos');
  }

  // Obter estatísticas dos logs
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<LogEntry['level'], number>,
      byCategory: {} as Record<string, number>,
      errors: this.logs.filter(log => log.level === 'ERROR').length,
      warnings: this.logs.filter(log => log.level === 'WARN').length
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    });

    return stats;
  }
}

// Instância singleton do logger
export const logger = new Logger();

// Utilitários específicos para upload de vídeo
export const VideoUploadLogger = {
  fileSelection: (file: File) => {
    logger.info('VIDEO_UPLOAD', 'Arquivo selecionado', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString(),
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
    });
  },

  fileValidation: (file: File, isValid: boolean, errors?: string[]) => {
    if (isValid) {
      logger.info('VIDEO_VALIDATION', 'Arquivo válido', {
        name: file.name,
        type: file.type,
        size: file.size
      });
    } else {
      logger.error('VIDEO_VALIDATION', 'Arquivo inválido', {
        name: file.name,
        type: file.type,
        size: file.size,
        errors
      });
    }
  },

  blobCreation: (file: File, blobUrl: string) => {
    logger.info('BLOB_URL', 'Blob URL criado com sucesso', {
      fileName: file.name,
      fileSize: file.size,
      blobUrl,
      blobUrlLength: blobUrl.length
    });
  },

  blobError: (file: File, error: any) => {
    logger.error('BLOB_URL', 'Erro ao criar blob URL', {
      fileName: file.name,
      fileSize: file.size,
      error: error.message || error,
      errorType: error.constructor?.name
    }, error);
  },

  videoElementLoad: (videoElement: HTMLVideoElement) => {
    logger.info('VIDEO_ELEMENT', 'Vídeo carregado no elemento', {
      src: videoElement.src,
      duration: videoElement.duration,
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      readyState: videoElement.readyState,
      networkState: videoElement.networkState
    });
  },

  videoElementError: (videoElement: HTMLVideoElement, error: any) => {
    logger.error('VIDEO_ELEMENT', 'Erro no elemento de vídeo', {
      src: videoElement.src,
      error: error.message || error,
      networkState: videoElement.networkState,
      readyState: videoElement.readyState,
      errorCode: error.code,
      errorType: error.constructor?.name
    }, error);
  },

  uploadStart: (file: File) => {
    logger.info('UPLOAD_PROCESS', 'Iniciando upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
  },

  uploadProgress: (progress: number, loaded: number, total: number) => {
    logger.debug('UPLOAD_PROGRESS', `Upload em progresso: ${progress}%`, {
      progress,
      loaded,
      total,
      loadedMB: (loaded / (1024 * 1024)).toFixed(2),
      totalMB: (total / (1024 * 1024)).toFixed(2)
    });
  },

  uploadSuccess: (response: any) => {
    logger.info('UPLOAD_PROCESS', 'Upload concluído com sucesso', {
      response
    });
  },

  uploadError: (error: any, file?: File) => {
    logger.error('UPLOAD_PROCESS', 'Erro durante upload', {
      fileName: file?.name,
      fileSize: file?.size,
      error: error.message || error,
      errorType: error.constructor?.name,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    }, error);
  }
};