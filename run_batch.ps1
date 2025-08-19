# Script PowerShell para executar MVP Store AI (Processamento em Lote)
Write-Host "Executando MVP Store AI (Processamento em Lote)..." -ForegroundColor Green
Write-Host ""

# Carregar variáveis de ambiente do arquivo .env
if (Test-Path ".env") {
    Write-Host "Carregando variáveis de ambiente do arquivo .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Variáveis de ambiente carregadas!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Arquivo .env não encontrado!" -ForegroundColor Yellow
}

# Ativar o ambiente virtual
& ".\.venv\Scripts\Activate.ps1"

# Executar o programa com processamento em lote
& python "src\mvp_store_ai.py" --video "data\videos\video2.mp4" --rois "rois.json" --camera-id "cam02"

Write-Host ""
Write-Host "Programa finalizado." -ForegroundColor Green
Read-Host "Pressione Enter para sair"
