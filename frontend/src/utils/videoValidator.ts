import { logger, VideoUploadLogger } from './logger';

export interface VideoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    extension: string;
    sizeInMB: number;
  };
  technicalInfo?: {
    duration?: number;
    width?: number;
    height?: number;
    bitrate?: number;
    codec?: string;
  };
}

export class VideoValidator {
  private static readonly SUPPORTED_FORMATS = [
    'video/mp4',
    'video/quicktime', // .mov files
    'video/x-msvideo', // .avi files
  ];

  private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private static readonly MIN_FILE_SIZE = 1024; // 1KB

  static async validateFile(file: File): Promise<VideoValidationResult> {
    logger.info('VIDEO_VALIDATOR', 'Iniciando validação de arquivo', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const result: VideoValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        extension: this.getFileExtension(file.name),
        sizeInMB: parseFloat((file.size / (1024 * 1024)).toFixed(2))
      }
    };

    // Validação básica de arquivo
    this.validateBasicFile(file, result);
    
    // Validação de formato
    this.validateFormat(file, result);
    
    // Validação de tamanho
    this.validateSize(file, result);
    
    // Validação de extensão
    this.validateExtension(file, result);

    // Tentar obter informações técnicas do vídeo
    try {
      const technicalInfo = await this.getTechnicalInfo(file);
      result.technicalInfo = technicalInfo;
      
      // Validações baseadas em informações técnicas
      this.validateTechnicalSpecs(technicalInfo, result);
    } catch (error) {
      logger.warn('VIDEO_VALIDATOR', 'Não foi possível obter informações técnicas do vídeo', {
        fileName: file.name,
        error: error instanceof Error ? error.message : error
      });
      result.warnings.push('Não foi possível analisar as propriedades técnicas do vídeo');
    }

    // Log do resultado final
    VideoUploadLogger.fileValidation(file, result.isValid, result.errors);

    if (result.errors.length > 0) {
      result.isValid = false;
      logger.error('VIDEO_VALIDATOR', 'Arquivo rejeitado na validação', {
        fileName: file.name,
        errors: result.errors,
        warnings: result.warnings
      });
    } else {
      logger.info('VIDEO_VALIDATOR', 'Arquivo aprovado na validação', {
        fileName: file.name,
        warnings: result.warnings,
        technicalInfo: result.technicalInfo
      });
    }

    return result;
  }

  private static validateBasicFile(file: File, result: VideoValidationResult) {
    if (!file) {
      result.errors.push('Nenhum arquivo foi selecionado');
      return;
    }

    if (!file.name) {
      result.errors.push('Nome do arquivo está vazio');
    }

    if (file.size === 0) {
      result.errors.push('Arquivo está vazio');
    }
  }

  private static validateFormat(file: File, result: VideoValidationResult) {
    logger.debug('VIDEO_VALIDATOR', 'Validando formato do arquivo', {
      detectedType: file.type,
      supportedFormats: this.SUPPORTED_FORMATS
    });

    if (!file.type) {
      result.warnings.push('Tipo MIME do arquivo não foi detectado');
      return;
    }

    if (!this.SUPPORTED_FORMATS.includes(file.type)) {
      result.errors.push(`Formato não suportado: ${file.type}. Formatos aceitos: ${this.SUPPORTED_FORMATS.join(', ')}`);
    }
  }

  private static validateSize(file: File, result: VideoValidationResult) {
    logger.debug('VIDEO_VALIDATOR', 'Validando tamanho do arquivo', {
      fileSize: file.size,
      fileSizeMB: result.fileInfo.sizeInMB,
      maxSizeMB: this.MAX_FILE_SIZE / (1024 * 1024),
      minSizeKB: this.MIN_FILE_SIZE / 1024
    });

    if (file.size > this.MAX_FILE_SIZE) {
      result.errors.push(`Arquivo muito grande: ${result.fileInfo.sizeInMB}MB. Tamanho máximo: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (file.size < this.MIN_FILE_SIZE) {
      result.errors.push(`Arquivo muito pequeno: ${file.size} bytes. Tamanho mínimo: ${this.MIN_FILE_SIZE} bytes`);
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      result.warnings.push('Arquivo grande pode demorar para fazer upload');
    }
  }

  private static validateExtension(file: File, result: VideoValidationResult) {
    const extension = this.getFileExtension(file.name).toLowerCase();
    const supportedExtensions = ['.mp4', '.mov', '.avi'];

    logger.debug('VIDEO_VALIDATOR', 'Validando extensão do arquivo', {
      fileName: file.name,
      extension,
      supportedExtensions
    });

    if (!extension) {
      result.errors.push('Arquivo não possui extensão');
      return;
    }

    if (!supportedExtensions.includes(extension)) {
      result.errors.push(`Extensão não suportada: ${extension}. Extensões aceitas: ${supportedExtensions.join(', ')}`);
    }

    // Verificar se a extensão corresponde ao tipo MIME
    if (extension === '.mp4' && file.type && !file.type.includes('mp4')) {
      result.warnings.push('Extensão .mp4 mas tipo MIME diferente detectado');
    }
  }

  private static validateTechnicalSpecs(technicalInfo: any, result: VideoValidationResult) {
    if (!technicalInfo) return;

    logger.debug('VIDEO_VALIDATOR', 'Validando especificações técnicas', technicalInfo);

    // Validar duração
    if (technicalInfo.duration) {
      if (technicalInfo.duration > 3600) { // 1 hora
        result.warnings.push('Vídeo muito longo (mais de 1 hora)');
      }
      if (technicalInfo.duration < 1) { // 1 segundo
        result.warnings.push('Vídeo muito curto (menos de 1 segundo)');
      }
    }

    // Validar resolução
    if (technicalInfo.width && technicalInfo.height) {
      const totalPixels = technicalInfo.width * technicalInfo.height;
      
      if (totalPixels > 3840 * 2160) { // 4K
        result.warnings.push('Resolução muito alta (acima de 4K)');
      }
      
      if (totalPixels < 320 * 240) { // Muito baixa
        result.warnings.push('Resolução muito baixa');
      }
    }
  }

  private static getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  }

  private static async getTechnicalInfo(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.remove();
      };

      video.onloadedmetadata = () => {
        const info = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight
        };
        
        logger.debug('VIDEO_VALIDATOR', 'Informações técnicas obtidas', info);
        cleanup();
        resolve(info);
      };

      video.onerror = (error) => {
        logger.warn('VIDEO_VALIDATOR', 'Erro ao obter informações técnicas', {
          error: error,
          fileName: file.name
        });
        cleanup();
        reject(new Error('Não foi possível analisar o vídeo'));
      };

      // Timeout para evitar travamento
      setTimeout(() => {
        cleanup();
        reject(new Error('Timeout ao analisar vídeo'));
      }, 10000);

      video.src = objectUrl;
      video.load();
    });
  }

  // Método para validação rápida (apenas básica)
  static validateQuick(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('Nenhum arquivo selecionado');
      return { isValid: false, errors };
    }

    const extension = this.getFileExtension(file.name).toLowerCase();
    if (extension !== '.mp4') {
      errors.push('Apenas arquivos .mp4 são suportados');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`Arquivo muito grande. Máximo: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (file.size === 0) {
      errors.push('Arquivo está vazio');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}