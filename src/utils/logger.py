# src/utils/logger.py
import logging
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path

class VideoUploadLogger:
    """Sistema de log detalhado para upload de vídeos no backend"""
    
    def __init__(self):
        # Criar diretório de logs se não existir
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        # Configurar logger principal
        self.logger = logging.getLogger("video_upload")
        self.logger.setLevel(logging.DEBUG)
        
        # Remover handlers existentes para evitar duplicação
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        
        # Handler para arquivo de log geral
        file_handler = logging.FileHandler(
            log_dir / f"video_upload_{datetime.now().strftime('%Y%m%d')}.log",
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Handler para console
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # Formato detalhado para logs
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
    def log_upload_start(self, filename: str, content_type: str, file_size: Optional[int] = None):
        """Log do início do processo de upload"""
        self.logger.info(f"UPLOAD_START - Arquivo: {filename}")
        self.logger.debug(f"UPLOAD_START - Detalhes: tipo={content_type}, tamanho={file_size}")
    
    def log_validation(self, filename: str, content_type: str, is_valid: bool, reason: str = ""):
        """Log da validação do arquivo"""
        status = "VÁLIDO" if is_valid else "INVÁLIDO"
        self.logger.info(f"VALIDATION - {filename}: {status}")
        if not is_valid:
            self.logger.warning(f"VALIDATION_FAILED - {filename}: {reason}")
        else:
            self.logger.debug(f"VALIDATION_SUCCESS - {filename}: tipo={content_type}")
    
    def log_file_save_start(self, filename: str, file_path: str):
        """Log do início da gravação do arquivo"""
        self.logger.info(f"FILE_SAVE_START - {filename} -> {file_path}")
    
    def log_file_save_progress(self, filename: str, bytes_written: int, total_size: Optional[int] = None):
        """Log do progresso da gravação"""
        if total_size:
            percentage = (bytes_written / total_size) * 100
            self.logger.debug(f"FILE_SAVE_PROGRESS - {filename}: {bytes_written}/{total_size} bytes ({percentage:.1f}%)")
        else:
            self.logger.debug(f"FILE_SAVE_PROGRESS - {filename}: {bytes_written} bytes escritos")
    
    def log_file_save_complete(self, filename: str, file_path: str, final_size: int):
        """Log da conclusão da gravação"""
        self.logger.info(f"FILE_SAVE_COMPLETE - {filename}: {final_size} bytes salvos em {file_path}")
    
    def log_upload_success(self, filename: str, file_path: str, processing_time: float):
        """Log de sucesso do upload"""
        self.logger.info(f"UPLOAD_SUCCESS - {filename} processado em {processing_time:.2f}s")
        self.logger.debug(f"UPLOAD_SUCCESS - Arquivo salvo: {file_path}")
    
    def log_upload_error(self, filename: str, error: Exception, stage: str = "unknown"):
        """Log de erro durante o upload"""
        self.logger.error(f"UPLOAD_ERROR - {filename} falhou no estágio '{stage}': {str(error)}")
        self.logger.debug(f"UPLOAD_ERROR - Detalhes do erro: {type(error).__name__}: {str(error)}")
    
    def log_system_info(self, info: Dict[str, Any]):
        """Log de informações do sistema"""
        self.logger.debug(f"SYSTEM_INFO - {json.dumps(info, indent=2)}")
    
    def log_request_details(self, headers: Dict[str, str], client_info: Dict[str, Any]):
        """Log de detalhes da requisição"""
        self.logger.debug(f"REQUEST_DETAILS - Headers: {json.dumps(dict(headers), indent=2)}")
        self.logger.debug(f"REQUEST_DETAILS - Client: {json.dumps(client_info, indent=2)}")

# Instância global do logger
upload_logger = VideoUploadLogger()