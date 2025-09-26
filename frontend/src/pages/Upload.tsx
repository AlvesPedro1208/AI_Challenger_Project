import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Upload as UploadIcon, 
  Video, 
  Play, 
  Pause, 
  Square, 
  Trash2,
  Edit,
  Save,
  Plus,
  MapPin,
  Check,
  X,
  Brain,
  Terminal,
  Users,
  ShoppingCart,
  Eye,
  EyeOff,
  Clock,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { logger, VideoUploadLogger } from "@/utils/logger";
import { VideoValidator } from "@/utils/videoValidator";
import "@/utils/logViewer";

// Definindo a URL base da API
const API_URL = "http://127.0.0.1:8000";

// Desativar console.log em produção
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
}

// Interface para os pontos do polígono
interface Point {
  x: number;
  y: number;
}

// Interface para as ROIs poligonais
interface PolygonROI {
  id: number;
  name: string;
  points: Point[];
  category?: string; // Campo opcional para categorização das prateleiras
}

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rois, setRois] = useState<Array<{
    id: number;
    name: string;
    category: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([]);
  const [savedVideos, setSavedVideos] = useState<Array<{
    filename: string;
    path: string;
    url: string;
    size: number;
    created_at: number;
    modified_at: number;
  }>>([]);
  
  // Estado para ROIs salvas do backend
  const [savedRois, setSavedRois] = useState<{[videoName: string]: Array<{name: string, points: number[][]}>}>({});
  
  // Estados para marcação de ROIs poligonais
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [polygonRois, setPolygonRois] = useState<PolygonROI[]>([]);
  const [roiName, setRoiName] = useState('');
  const [showRoiNameInput, setShowRoiNameInput] = useState(false);
  
  // Estados para análise comportamental
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<Array<{
    timestamp: string;
    type: 'customer_entry' | 'customer_exit' | 'product_interaction' | 'info';
    message: string;
    details?: any;
  }>>([]);
  const [analysisStats, setAnalysisStats] = useState({
    totalCustomers: 0,
    productInteractions: 0
  });
  const [analysisDuration, setAnalysisDuration] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAnalyzingRef = useRef<boolean>(false);

  // Carregar ROIs e vídeos salvos ao iniciar
  useEffect(() => {
    fetchRois();
    fetchVideos();
  }, []);

  // Selecionar automaticamente o primeiro vídeo disponível para análise
  useEffect(() => {
    if (savedVideos.length > 0 && !selectedVideoForAnalysis) {
      const firstVideo = savedVideos[0].filename;
      setSelectedVideoForAnalysis(firstVideo);
      console.log("Vídeo selecionado automaticamente para análise:", firstVideo);
    }
  }, [savedVideos, selectedVideoForAnalysis]);

  // Limpeza de recursos ao desmontar o componente
  useEffect(() => {
    return () => {
      // Revogar blob URL ao desmontar o componente
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Redesenhar o canvas sempre que currentPoints mudar
  useEffect(() => {
    if (canvasRef.current && videoRef.current) {
      drawCanvas();
    }
  }, [currentPoints]);

  // Função para buscar ROIs do backend
  const fetchRois = async () => {
    try {
      const response = await axios.get(`${API_URL}/get-rois`, {
        timeout: 10000
      });
      console.log("ROIs carregadas do backend:", response.data);
      if (response.data) {
        setSavedRois(response.data);
      }
    } catch (error) {
      console.error("Erro ao buscar ROIs:", error);
      console.log("Não foi possível carregar as ROIs salvas - isso é normal se ainda não há ROIs salvas");
    }
  };

  // Função para buscar vídeos do backend
  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API_URL}/get-videos`, {
        // Adicionar timeout para evitar erros de conexão
        timeout: 10000
      });
      if (response.data && response.data.videos) {
        setSavedVideos(response.data.videos);
      }
    } catch (error) {
      console.error("Erro ao buscar vídeos:", error);
      // Usar console.log em vez de toast para evitar erros de renderização
      console.log("Não foi possível carregar os vídeos salvos");
    }
  };

  // Função para selecionar um vídeo da lista de vídeos salvos
  const selectSavedVideo = async (video: typeof savedVideos[0]) => {
    try {
      logger.info('SAVED_VIDEO_SELECTION', 'Selecionando vídeo salvo', {
        filename: video.filename,
        size: video.size,
        url: video.url
      });

      // Construir URL completa do vídeo
      const videoUrl = `${API_URL}${video.url}`;
      
      // Limpar estados anteriores
      setSelectedFile(null);
      setVideoUrl(videoUrl);
      setShowPreview(true); // Mostrar pré-visualização imediatamente para vídeos salvos
      setUploadProgress(0);
      setCurrentPoints([]);
      setPolygonRois([]);
      setIsDrawingMode(false);
      setShowRoiNameInput(false);

      toast.success(`Vídeo "${video.filename}" selecionado para marcação de ROIs!`);
      
    } catch (error) {
      logger.error('SAVED_VIDEO_SELECTION', 'Erro ao selecionar vídeo salvo', {
        filename: video.filename,
        error: error instanceof Error ? error.message : error
      });
      toast.error("Erro ao carregar o vídeo selecionado");
    }
  };

  // Funções para manipulação de arquivos
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        handleFileUpload(file);
      } else {
        toast.error("Por favor, selecione apenas arquivos de vídeo.");
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      // Validar o arquivo
      const validation = await VideoValidator.validateFile(file);
      if (!validation.isValid) {
        const errorMessage = validation.errors.length > 0 ? validation.errors[0] : "Arquivo inválido";
        toast.error(errorMessage);
        return;
      }

      setSelectedFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setUploadProgress(0);
      setIsUploaded(false);
      setRois([]);
      setCurrentPoints([]);
      setIsDrawingMode(false);
      
      toast.success("Arquivo selecionado com sucesso!");
      logger.info("Arquivo selecionado", { fileName: file.name, fileSize: file.size });
    } catch (error) {
      console.error("Erro na validação do arquivo:", error);
      toast.error("Erro ao validar o arquivo. Tente novamente.");
    }
  };

  // Função para fazer upload do vídeo para o servidor
  const uploadVideo = async () => {
    if (!selectedFile) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setIsUploaded(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API_URL}/upload-video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
      });

      if (response.status === 200) {
        setIsUploaded(true);
        setUploadProgress(100);
        toast.success("Vídeo enviado com sucesso!");
        
        // Atualizar a lista de vídeos salvos
        await fetchVideos();
        
        logger.info("Upload concluído", { 
          fileName: selectedFile.name, 
          fileSize: selectedFile.size,
          response: response.data 
        });
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar o vídeo. Tente novamente.");
      setUploadProgress(0);
      setIsUploaded(false);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Funções para manipulação do canvas e ROIs
  
  // Iniciar o modo de desenho
  const startDrawingMode = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Verificar se o vídeo está carregado
    if (video.readyState < 2) {
      toast.error("Aguarde o vídeo carregar completamente antes de marcar as ROIs.");
      return;
    }
    
    // Pausar o vídeo para facilitar a marcação
    video.pause();
    setIsPlaying(false);
    setIsDrawingMode(true);
    setCurrentPoints([]);
    
    // Configurar o canvas com as dimensões do vídeo
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      
      // Obter as dimensões reais do vídeo
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      if (videoWidth && videoHeight) {
        // Configurar o canvas com as dimensões do vídeo
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        // Desenhar o frame atual do vídeo no canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
          drawCanvas(); // Desenhar ROIs existentes
        }
        
        toast.success("Modo de marcação ativado. Clique para adicionar pontos ao polígono.");
      } else {
        toast.error("Não foi possível obter as dimensões do vídeo. Tente novamente.");
      }
    }
  };
  
  // Parar o modo de desenho
  const stopDrawingMode = () => {
    setIsDrawingMode(false);
    setCurrentPoints([]);
    setShowRoiNameInput(false);
  };
  
  // Manipular clique no canvas para adicionar pontos ao polígono (igual ao script Python)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDrawingMode || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calcular a posição do clique relativa ao canvas
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
    
    // Verificar se as coordenadas são válidas
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
    
    // Adicionar o ponto à lista de pontos atuais (sem fechamento automático)
    const newPoints = [...currentPoints, { x, y }];
    setCurrentPoints(newPoints);
    
    console.log(`Ponto adicionado: (${x}, ${y}). Total de pontos: ${newPoints.length}`);
  };

  // Manipular clique direito no canvas para remover último ponto (igual ao script Python)
  const handleCanvasRightClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDrawingMode || currentPoints.length === 0) return;
    
    // Remover o útimo ponto
    const newPoints = currentPoints.slice(0, -1);
    setCurrentPoints(newPoints);
    
    console.log(`Ponto removido. Total de pontos: ${newPoints.length}`);
  };

  // Manipular duplo clique no canvas para fechar o polígono
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDrawingMode || currentPoints.length < 3) return;
    
    console.log('Fechando polígono - duplo clique detectado');
    completePolygon();
  };
  
  
  // Fechar o polígono atual (equivalente à tecla 'C' do script Python)
  const closePolygon = () => {
    if (currentPoints.length < 3) {
      toast.error('É necessário pelo menos 3 pontos para fechar o polígono');
      return;
    }
    
    console.log('Fechando polígono com', currentPoints.length, 'pontos');
    
    // Mostrar o modal para nomear a ROI
    setShowRoiNameInput(true);
  };

  // Completar o polígono atual
  const completePolygon = () => {
    if (currentPoints.length < 3) {
      console.log('Não é possível completar polígono - menos de 3 pontos:', currentPoints.length);
      toast.error('É necessário pelo menos 3 pontos para criar uma prateleira');
      return;
    }
    
    console.log('Completando polígono com', currentPoints.length, 'pontos');
    console.log('Exibindo modal para nomear ROI');
    
    // Mostrar o modal para nomear a ROI
    setShowRoiNameInput(true);
  };
  
  // Salvar o polígono atual como uma ROI
  const savePolygon = () => {
    if (currentPoints.length < 3 || !roiName.trim()) return;
    
    // Criar uma nova ROI
    const newRoi: PolygonROI = {
      id: Date.now(),
      name: roiName.trim(),
      points: [...currentPoints]
    };
    
    // Adicionar a ROI à lista
    setPolygonRois([...polygonRois, newRoi]);
    
    // Limpar os estados
    setCurrentPoints([]);
    setRoiName("");
    setShowRoiNameInput(false);
    
    // Redesenhar o canvas
    drawCanvas();
    
    // Notificar o usuário
    toast.success(`Prateleira "${newRoi.name}" marcada com sucesso!`);
  };
  
  // Cancelar a criação do polígono atual
  const cancelPolygon = () => {
    setCurrentPoints([]);
    setRoiName("");
    setShowRoiNameInput(false);
    drawCanvas();
  };
  
  // Remover uma ROI da lista
  const removePolygonRoi = (id: number) => {
    setPolygonRois(polygonRois.filter(roi => roi.id !== id));
    drawCanvas();
  };
  
  // Desenhar o canvas com as ROIs e pontos atuais
  const drawCanvas = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Verificar se o vídeo está carregado
    if (video.readyState < 2) return;
    
    // Limpar o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar o frame atual do vídeo
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.warn('Erro ao desenhar vídeo no canvas:', error);
      return;
    }
    
    // Desenhar as ROIs existentes
    polygonRois.forEach(roi => {
      if (roi.points.length < 3) return;
      
      ctx.beginPath();
      ctx.moveTo(roi.points[0].x, roi.points[0].y);
      
      for (let i = 1; i < roi.points.length; i++) {
        ctx.lineTo(roi.points[i].x, roi.points[i].y);
      }
      
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Desenhar o nome da ROI
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(roi.name, roi.points[0].x, roi.points[0].y - 5);
    });
    
    // Desenhar os pontos atuais
    if (currentPoints.length > 0) {
      // Desenhar as linhas entre os pontos
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      
      // Não fechar automaticamente o polígono (igual ao script Python)
      
      ctx.strokeStyle = 'hsl(var(--primary))'; // Cor primária do tema
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Desenhar os pontos (todos iguais, azuis, igual ao script Python)
      currentPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); // Raio 4 igual ao script Python
        ctx.fillStyle = 'hsl(var(--primary))'; // Cor primária do tema
        ctx.fill();
      });
    }
  };
  
  // Salvar as ROIs no backend
  const savePolygonRois = async () => {
    if (polygonRois.length === 0) {
      toast.error("Nenhuma ROI foi marcada para salvar.");
      return;
    }
    
    // Determinar o nome do arquivo de vídeo
    let videoFilename = "";
    if (selectedFile) {
      videoFilename = selectedFile.name;
    } else if (videoUrl) {
      // Extrair nome do arquivo da URL do vídeo salvo
      const urlParts = videoUrl.split('/');
      videoFilename = urlParts[urlParts.length - 1];
    } else {
      toast.error("Nenhum vídeo selecionado.");
      return;
    }
    
    try {
      // Preparar os dados para envio - convertendo para o formato esperado pelo backend
      const roisData = {
        video_filename: videoFilename,
        rois: polygonRois.map(roi => ({
          id: roi.id,
          name: roi.name || `Prateleira ${roi.id}`,
          points: roi.points.map(point => ({ x: point.x, y: point.y }))
        }))
      };
      
      console.log("Enviando dados para o backend:", JSON.stringify(roisData, null, 2));
      
      // Enviar para o backend com timeout
      const response = await axios.post(`${API_URL}/rois`, roisData, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log("ROIs salvas com sucesso!", response.data);
      toast.success(`ROIs salvas com sucesso! ${response.data.rois_count} prateleiras salvas para ${response.data.video}.`);
      
      // Atualizar a lista de ROIs após salvar
      try {
        await fetchRois();
      } catch (e) {
        console.error("Erro ao atualizar ROIs:", e);
      }
    } catch (error) {
      console.error("Erro ao salvar as ROIs:", error);
      if (axios.isAxiosError(error)) {
        toast.error(`Erro ao salvar ROIs: ${error.response?.data?.detail || error.message}`);
      } else {
        toast.error("Erro ao salvar ROIs. Tente novamente.");
      }
    }
  };

  // Funções para análise comportamental
  const startBehaviorAnalysis = async () => {
    // Se nenhum vídeo estiver selecionado, selecionar automaticamente o primeiro disponível
    let videoToAnalyze = selectedVideoForAnalysis;
    if (!videoToAnalyze && savedVideos.length > 0) {
      videoToAnalyze = savedVideos[0].filename;
      setSelectedVideoForAnalysis(videoToAnalyze);
      console.log("Vídeo selecionado automaticamente para análise:", videoToAnalyze);
    }

    if (!videoToAnalyze) {
      toast.error("Nenhum vídeo disponível para análise.");
      return;
    }

    // Verificar se há ROIs para o vídeo selecionado
    const videoRois = savedRois[videoToAnalyze];
    const roisArray = Array.isArray(videoRois) ? videoRois : [];
    if (!videoRois || roisArray.length === 0) {
      toast.error("Nenhuma ROI encontrada para este vídeo. Marque as ROIs primeiro.");
      return;
    }

    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    console.log("Estado isAnalyzing definido como true");
    setAnalysisLogs([]);
    setAnalysisStats({
      totalCustomers: 0,
      productInteractions: 0
    });

    try {
      // Chamar endpoint do backend para iniciar análise
      console.log("Enviando requisição para iniciar análise:", videoToAnalyze);
      const response = await axios.post(`${API_URL}/analyze-behavior`, {
        video_filename: videoToAnalyze
      });

      console.log("Resposta da análise:", response.data);
      if (response.data.status === 'success') {
        // Adicionar logs iniciais do backend
        response.data.initial_logs.forEach((log: any) => {
          addAnalysisLog(log.type, log.message);
        });

        // Definir estatísticas iniciais - mapear do formato do backend para o frontend
        if (response.data.initial_stats) {
          setAnalysisStats({
            totalCustomers: response.data.initial_stats.total_customers || 0,
            productInteractions: response.data.initial_stats.product_interactions || 0
          });
        }

        // Capturar duração da análise do backend
        if (response.data.duration_seconds) {
          setAnalysisDuration(response.data.duration_seconds);
        }

        addAnalysisLog('info', response.data.message);
        
        // Iniciar polling para obter atualizações em tempo real
        startRealTimePolling(videoToAnalyze);

        toast.success("Análise comportamental iniciada!");
      }
    } catch (error) {
      console.error("Erro ao iniciar análise:", error);
      toast.error("Erro ao iniciar análise comportamental.");
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
    }
  };

  const addAnalysisLog = (type: 'customer_entry' | 'customer_exit' | 'product_interaction' | 'info', message: string, details?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setAnalysisLogs(prev => [...prev, { timestamp, type, message, details }]);
  };

  // Função para polling em tempo real
  const startRealTimePolling = (videoFilename: string) => {
    console.log("Iniciando polling para vídeo:", videoFilename);
    console.log("Estado isAnalyzing no início do polling:", isAnalyzingRef.current);
    const interval = setInterval(async () => {
      console.log("Executando polling - isAnalyzing:", isAnalyzingRef.current);
      if (!isAnalyzingRef.current) {
        console.log("Parando polling - isAnalyzing é false");
        clearInterval(interval);
        return;
      }

      if (!videoFilename) {
        console.error("videoFilename está vazio durante o polling");
        clearInterval(interval);
        return;
      }

      try {
        const url = `${API_URL}/analysis-status/${videoFilename}`;
        console.log("Fazendo requisição para:", url);
        console.log("API_URL:", API_URL);
        console.log("videoFilename:", videoFilename);
        
        const response = await axios.get(url);
        console.log("Resposta da API recebida:", response.data);
        console.log("Status da resposta:", response.status);
        
        if (response.data.status === 'analyzing') {
          // Processar múltiplos logs se disponíveis
          if (response.data.new_logs && Array.isArray(response.data.new_logs)) {
            response.data.new_logs.forEach((log: any) => {
              addAnalysisLog(log.type, log.message, log.details);
              
              // Detectar mensagem "Total" para finalizar análise automaticamente
              if (log.message && log.message.includes("Total:")) {
                console.log("Detectada mensagem de conclusão no frontend:", log.message);
                setIsAnalyzing(false);
                isAnalyzingRef.current = false;
                setAnalysisCompleted(true);
                setAnalysisProgress(100);
                toast.success("Análise comportamental concluída com sucesso!");
                clearInterval(interval);
                return;
              }
            });
          } else if (response.data.new_log) {
            // Fallback para um único log
            addAnalysisLog(response.data.new_log.type, response.data.new_log.message, response.data.new_log.details);
            
            // Detectar mensagem "Total" para finalizar análise automaticamente
            if (response.data.new_log.message && response.data.new_log.message.includes("Total:")) {
              console.log("Detectada mensagem de conclusão no frontend:", response.data.new_log.message);
              setIsAnalyzing(false);
              isAnalyzingRef.current = false;
              setAnalysisCompleted(true);
              setAnalysisProgress(100);
              toast.success("Análise comportamental concluída com sucesso!");
              clearInterval(interval);
              return;
            }
          }
          
          // Atualizar estatísticas - mapear do formato do backend para o frontend
          if (response.data.updated_stats) {
            setAnalysisStats({
              totalCustomers: response.data.updated_stats.total_customers || 0,
              productInteractions: response.data.updated_stats.product_interactions || 0
            });
          }
          
          // Atualizar progresso
          if (response.data.progress) {
            setAnalysisProgress(response.data.progress);
          }
        } else if (response.data.status === 'completed') {
          // Análise concluída
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
          setAnalysisCompleted(true);
          setAnalysisProgress(100);
          
          // Adicionar todos os logs da análise
          if (response.data.all_logs && Array.isArray(response.data.all_logs)) {
            // Limpar logs anteriores e adicionar todos os logs da sessão
            setAnalysisLogs([]);
            response.data.all_logs.forEach((log: any) => {
              addAnalysisLog(log.type, log.message);
            });
          }
          
          // Adicionar log de conclusão
          if (response.data.completion_log) {
            addAnalysisLog(response.data.completion_log.type, response.data.completion_log.message);
          }
          
          // Atualizar estatísticas finais - mapear do formato do backend para o frontend
          if (response.data.final_stats) {
            setAnalysisStats({
              totalCustomers: response.data.final_stats.total_customers || 0,
              productInteractions: response.data.final_stats.product_interactions || 0
            });
          }
          
          toast.success("Análise comportamental concluída com sucesso!");
          clearInterval(interval);
        } else if (response.data.status === 'not_found') {
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
          addAnalysisLog('info', 'Sessão de análise não encontrada');
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Erro ao obter status da análise:', error);
        console.error('Detalhes do erro:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: `${API_URL}/analysis-status/${videoFilename}`
        });
        // Em caso de erro, continuar tentando por mais algumas vezes
      }
    }, 3000); // Polling a cada 3 segundos

    // Parar polling após 10 minutos (backup)
    setTimeout(() => {
      clearInterval(interval);
      if (isAnalyzingRef.current && !analysisCompleted) {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        addAnalysisLog('info', 'Análise interrompida por timeout');
        toast.warning("Análise interrompida por timeout");
      }
    }, 600000); // 10 minutos
  };

  const stopBehaviorAnalysis = () => {
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    setAnalysisCompleted(true);
    addAnalysisLog('info', 'Análise comportamental interrompida pelo usuário');
    toast.info("Análise comportamental interrompida.");
  };

  const resetAnalysis = async () => {
    try {
      // Chamar endpoint para resetar análise no backend
      if (selectedVideoForAnalysis) {
        await axios.post(`${API_URL}/reset-analysis/${selectedVideoForAnalysis}`);
      }
      
      // Resetar estado local
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
      setAnalysisCompleted(false);
      setAnalysisProgress(0);
      setAnalysisLogs([]);
      setAnalysisStats({
        totalCustomers: 0,
        productInteractions: 0
      });
      setAnalysisDuration(0);
      
      toast.success("Análise resetada com sucesso!");
    } catch (error) {
      console.error("Erro ao resetar análise:", error);
      toast.error("Erro ao resetar análise.");
    }
  };

  const addROI = () => {
    const newROI = {
      id: Date.now(),
      name: `Nova ROI ${rois.length + 1}`,
      category: "Produtos",
      x: Math.random() * 400,
      y: Math.random() * 200,
      width: 150,
      height: 100,
    };
    setRois([...rois, newROI]);
    toast.success("Nova ROI adicionada!");
  };

  const removeROI = (id: number) => {
    setRois(rois.filter(roi => roi.id !== id));
    toast.success("ROI removida!");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-display">Upload de Vídeos & ROIs</h1>
        <p className="text-muted-foreground mt-1 font-body">
          Faça upload de vídeos e configure regiões de interesse para análise
        </p>
      </div>

      {/* Upload and Saved Videos Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card className="bg-gradient-card shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-display">
                <UploadIcon className="h-5 w-5 text-primary" />
                Upload de Vídeo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!selectedFile ? (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      Arraste um vídeo aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Suporte a MP4, AVI, MOV (máx. 100MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <Video className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setVideoUrl(null);
                          setUploadProgress(0);
                          setIsUploaded(false);
                          setShowPreview(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Enviando...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="w-full" />
                      </div>
                    )}

                    <Button
                      onClick={uploadVideo}
                      disabled={isUploading}
                      className="w-full bg-gradient-primary hover:opacity-90"
                    >
                      {isUploading ? "Enviando..." : "Fazer Upload"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Saved Videos Section */}
          {savedVideos.length > 0 && (
            <Card className="bg-gradient-card shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-display">
                  <Video className="h-5 w-5 text-primary" />
                  Vídeos Salvos ({savedVideos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {savedVideos.map((video, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => selectSavedVideo(video)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Video className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{video.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {(video.size / (1024 * 1024)).toFixed(1)} MB • {new Date(video.modified_at * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      {/* Video Preview */}
          {videoUrl && showPreview && (
            <Card className="bg-gradient-card shadow-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-display">
                    <Play className="h-5 w-5 text-primary" />
                    Pré-visualização
                  </CardTitle>
                  <div className="flex gap-2">
                    {!isDrawingMode ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={startDrawingMode}
                        className="bg-blue-500 text-white hover:bg-blue-600"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Marcar Prateleiras
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={stopDrawingMode}
                          className="bg-red-500 text-white hover:bg-red-600"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar Marcação
                        </Button>
                        {currentPoints.length >= 3 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={closePolygon}
                            className="bg-green-500 text-white hover:bg-green-600"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Fechar Polígono
                          </Button>
                        )}
                      </>
                    )}
                    {polygonRois.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={savePolygonRois}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar ROIs
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  {/* Vídeo original (escondido quando em modo de desenho) */}
                  <video
                    ref={videoRef}
                    src={videoUrl || ''}
                    className={`w-full h-full object-contain ${isDrawingMode ? 'hidden' : ''}`}
                    controls
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      const error = target.error;
                      
                      // Log detalhado do erro usando o sistema de logs
                      VideoUploadLogger.videoElementError(target, error);
                      
                      let errorMessage = 'Erro ao carregar o vídeo. ';
                      let errorDetails = '';
                      
                      if (error) {
                        switch (error.code) {
                          case MediaError.MEDIA_ERR_ABORTED:
                            errorMessage += 'Carregamento abortado.';
                            errorDetails = 'O usuário cancelou o carregamento';
                            break;
                          case MediaError.MEDIA_ERR_NETWORK:
                            errorMessage += 'Erro de rede.';
                            errorDetails = 'Falha na conexão durante o carregamento';
                            break;
                          case MediaError.MEDIA_ERR_DECODE:
                            errorMessage += 'Erro de decodificação.';
                            errorDetails = 'O arquivo pode estar corrompido ou em formato incompatível';
                            break;
                          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            errorMessage += 'Formato não suportado.';
                            errorDetails = 'O navegador não consegue reproduzir este formato de vídeo';
                            break;
                          default:
                            errorMessage += 'Erro desconhecido.';
                            errorDetails = `Código de erro: ${error.code}`;
                        }
                      }
                      
                      logger.error('VIDEO_PLAYBACK', 'Falha na reprodução do vídeo', {
                        errorMessage,
                        errorDetails,
                        fileName: selectedFile?.name,
                        videoUrl,
                        userAgent: navigator.userAgent
                      });
                      
                      toast.error(errorMessage + ' Tente selecionar novamente.');
                      
                      // Limpar o estado em caso de erro
                      if (videoUrl && videoUrl.startsWith('blob:')) {
                        logger.debug('CLEANUP', 'Revogando blob URL após erro de vídeo');
                        URL.revokeObjectURL(videoUrl);
                      }
                      setVideoUrl('');
                      setSelectedFile(null);
                      setShowPreview(false);
                    }}
                    onLoadStart={() => {
                      logger.info('VIDEO_ELEMENT', 'Iniciando carregamento do vídeo', {
                        videoUrl,
                        fileName: selectedFile?.name
                      });
                    }}
                    onLoadedData={() => {
                      const target = videoRef.current;
                      if (target) {
                        VideoUploadLogger.videoElementLoad(target);
                      }
                    }}
                    onCanPlay={() => {
                      logger.info('VIDEO_ELEMENT', 'Vídeo pronto para reprodução', {
                        fileName: selectedFile?.name,
                        duration: videoRef.current?.duration,
                        videoWidth: videoRef.current?.videoWidth,
                        videoHeight: videoRef.current?.videoHeight
                      });
                    }}
                  />
                  
                  {/* Canvas para desenho de ROIs */}
                  <canvas
                    ref={canvasRef}
                    className={`absolute top-0 left-0 w-full h-full ${isDrawingMode ? '' : 'hidden'}`}
                    onClick={handleCanvasClick}
                    onDoubleClick={handleCanvasDoubleClick}
                    onContextMenu={handleCanvasRightClick}
                  />
                  
                  {/* Modal para nomear ROI */}
                  {showRoiNameInput && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/70">
                      <div className="bg-card p-4 rounded-lg shadow-lg w-80">
                        <h3 className="text-lg font-medium mb-2 text-display">Nome da Prateleira</h3>
                        <Input
                          value={roiName}
                          onChange={(e) => setRoiName(e.target.value)}
                          placeholder="Ex: Prateleira A"
                          className="mb-4"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelPolygon}>
                            Cancelar
                          </Button>
                          <Button onClick={savePolygon}>
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-2">
                    {!isDrawingMode && (
                      <>
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Square className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {isDrawingMode ? "Modo de Marcação" : (isPlaying ? "Reproduzindo" : "Pausado")}
                  </Badge>
                </div>
                
                {/* Lista de ROIs poligonais */}
                {polygonRois.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2 text-display">Prateleiras Marcadas:</h3>
                    <div className="space-y-2">
                      {polygonRois.map((roi) => (
                        <div key={roi.id} className="flex items-center justify-between bg-secondary/30 p-2 rounded">
                          <span>{roi.name}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removePolygonRoi(roi.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

      {/* ROI Management */}
      <Card className="bg-gradient-card shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-display">
                <MapPin className="h-5 w-5 text-accent" />
                Gerenciar ROIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(savedRois).map(([videoName, videoRois], videoIndex) => {
                  // Garantir que videoRois seja um array
                  const roisArray = Array.isArray(videoRois) ? videoRois : [];
                  
                  return (
                  <div key={videoName} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                      <Video className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-sm text-display">{videoName}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {roisArray.length} ROI{roisArray.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {roisArray.map((roi, roiIndex) => (
                      <div key={`${videoName}-${roiIndex}`} className="p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`w-3 h-3 rounded ${
                                roiIndex % 4 === 0 ? 'bg-primary' :
                                roiIndex % 4 === 1 ? 'bg-accent' :
                                roiIndex % 4 === 2 ? 'bg-success' :
                                'bg-warning'
                              }`}
                            />
                            <div>
                              <p className="font-medium text-sm">{roi.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {roi.points.length} pontos marcados
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                // TODO: Implementar remoção de ROI específica
                                toast.info("Funcionalidade de remoção será implementada em breve");
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          Coordenadas: {roi.points.map(point => `(${point[0]}, ${point[1]})`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                  )
                })}
              </div>

              {Object.keys(savedRois).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ROI configurada</p>
                  <p className="text-sm">Marque ROIs nos vídeos e clique em "Salvar ROIs" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Behavioral Analysis */}
          <Card className="bg-gradient-card shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-display">
                <Brain className="h-5 w-5 text-accent" />
                Análise Comportamental
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Selecionar Vídeo para Análise</Label>
                <select 
                  value={selectedVideoForAnalysis}
                  onChange={(e) => setSelectedVideoForAnalysis(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  disabled={isAnalyzing}
                >
                  <option value="">Selecione um vídeo...</option>
                  {Object.keys(savedRois).map(videoName => (
                    <option key={videoName} value={videoName}>
                      {videoName} ({savedRois[videoName].length} ROI{savedRois[videoName].length !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Analysis Controls */}
              <div className="flex gap-2">
                {!analysisCompleted ? (
                  <>
                    <Button 
                      onClick={startBehaviorAnalysis}
                      disabled={!selectedVideoForAnalysis || isAnalyzing}
                      className="flex-1"
                      variant={isAnalyzing ? "secondary" : "default"}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      {isAnalyzing ? "Analisando..." : "Analisar Comportamento"}
                    </Button>
                    {isAnalyzing && (
                      <Button 
                        onClick={stopBehaviorAnalysis}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button 
                    onClick={resetAnalysis}
                    className="flex-1"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Análise
                  </Button>
                )}
              </div>

              {/* Progress Bar */}
              {(isAnalyzing || analysisCompleted) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso da Análise</span>
                    <span>{Math.round(analysisProgress)}%</span>
                  </div>
                  <Progress value={analysisProgress} className="w-full" />
                  {analysisCompleted && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      <span>Análise concluída e dados salvos no banco</span>
                    </div>
                  )}
                </div>
              )}



              {/* Real-time Terminal */}
              {(isAnalyzing || analysisLogs.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-accent" />
                    <Label className="text-sm font-medium">Terminal de Análise</Label>
                    {isAnalyzing && (
                      <Badge variant="secondary" className="text-xs animate-pulse">
                        <Activity className="h-3 w-3 mr-1" />
                        Em tempo real
                      </Badge>
                    )}
                  </div>
                  <div className="bg-black/90 text-green-400 p-3 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                    {analysisLogs.length === 0 ? (
                      <div className="text-gray-500">Aguardando eventos de análise...</div>
                    ) : (
                      analysisLogs.map((log, index) => (
                        <div key={index} className="mb-1 flex items-start gap-2">
                          <span className="text-gray-400 shrink-0">[{log.timestamp}]</span>
                          <span className={`
                            ${log.type === 'customer_entry' ? 'text-blue-400' : ''}
                            ${log.type === 'customer_exit' ? 'text-red-400' : ''}
                            ${log.type === 'product_interaction' ? 'text-yellow-400' : ''}
                            ${log.type === 'info' ? 'text-green-400' : ''}
                          `}>
                            {log.type === 'customer_entry' && '👤 '}
                            {log.type === 'customer_exit' && '🚪 '}
                            {log.type === 'product_interaction' && '🛒 '}
                            {log.type === 'info' && 'ℹ️  '}
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
};

export default Upload;