<#
  Gera o video exibido na landing page a partir de quadros demonstrativos.

  O roteiro evita capturas de dados reais: as telas preservam a linguagem visual e
  os fluxos do produto, mas usam informacoes ficticias. Sempre que os modulos ou o
  posicionamento comercial mudarem, atualize primeiro o script Python e os textos
  de narracao abaixo; depois execute este arquivo novamente na raiz do projeto.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Build = Join-Path $Root '.artifacts\institutional-video'
$Public = Join-Path $Root 'frontend\public'
$Ffmpeg = Join-Path $Root 'node_modules\ffmpeg-static\ffmpeg.exe'

# O runtime do Codex inclui Pillow; em outras maquinas, o Python padrao pode ser
# usado desde que o pacote Pillow esteja instalado.
$BundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$Python = if (Test-Path $BundledPython) { $BundledPython } else { 'python' }

if (-not (Test-Path $Ffmpeg)) {
  throw 'FFmpeg nao encontrado. Execute: npm install --no-save --package-lock=false ffmpeg-static@5.2.0'
}

New-Item -ItemType Directory -Force -Path $Build | Out-Null
& $Python (Join-Path $PSScriptRoot 'generate-institutional-frames.py')

# Cada cena possui duracao fixa para manter video, narracao e WebVTT sincronizados.
$Scenes = @(
  @{ Duration = 7.5; Narration = 'O ThermoSync conecta a infraestrutura refrigerada a uma operação mais previsível, rastreável e rápida para responder.' },
  @{ Duration = 8.5; Narration = 'Sensores e controladores enviam temperatura, umidade, energia e estado. A plataforma organiza cada leitura por empresa, loja e equipamento.' },
  @{ Duration = 10.0; Narration = 'No painel operacional, a equipe acompanha a saúde da frota e encontra primeiro os ativos que precisam de atenção.' },
  @{ Duration = 9.0; Narration = 'No monitoramento, cada equipamento mostra a leitura atual, a faixa esperada, o estado dos componentes e a tendência recente.' },
  @{ Duration = 9.5; Narration = 'Quando existe um desvio, o sistema prioriza a ocorrência, abre o chamado e registra responsável, horário e cada ação executada.' },
  @{ Duration = 9.0; Narration = 'O histórico se transforma em indicadores e relatórios para acompanhar conformidade, recorrência, tempo de resposta e auditoria.' },
  @{ Duration = 8.0; Narration = 'Você pode conhecer esse fluxo no teste gratuito, com equipamentos virtuais, ou solicitar uma implantação definitiva para sua empresa.' }
)

# A narracao usa uma voz neural pt-BR para manter pronuncia e ritmo consistentes.
# Instale a dependencia no Python selecionado com ``python -m pip install edge-tts``.
& $Python -c 'import edge_tts' 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'edge-tts nao encontrado. Instale com: python -m pip install edge-tts'
}

$ConcatLines = @()
for ($Index = 0; $Index -lt $Scenes.Count; $Index++) {
  $Number = $Index + 1
  $Frame = Join-Path $Build ('frame-{0:d2}.png' -f $Number)
  $Voice = Join-Path $Build ('voice-{0:d2}.mp3' -f $Number)
  $Segment = Join-Path $Build ('segment-{0:d2}.mp4' -f $Number)
  $Duration = [double]$Scenes[$Index].Duration
  $FadeOut = [Math]::Max(0, $Duration - 0.35).ToString([Globalization.CultureInfo]::InvariantCulture)
  $DurationText = $Duration.ToString([Globalization.CultureInfo]::InvariantCulture)

  # Reaproveita locuções já geradas para que ajustes puramente visuais possam ser
  # renderizados novamente sem depender de rede ou consumir tempo desnecessário.
  if (-not (Test-Path $Voice) -or (Get-Item $Voice).Length -eq 0) {
    & $Python -m edge_tts --voice 'pt-BR-FranciscaNeural' '--rate=-3%' `
      --text $Scenes[$Index].Narration --write-media $Voice
    if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar a narracao da cena $Number." }
  }

  # A imagem recebe uma entrada e saida suaves; o audio e completado com silencio
  # quando a locucao termina antes da duracao reservada para leitura da tela.
  & $Ffmpeg -hide_banner -loglevel error -y `
    -loop 1 -framerate 30 -i $Frame -i $Voice `
    -vf "scale=1280:720,fade=t=in:st=0:d=0.35,fade=t=out:st=$FadeOut`:d=0.35,format=yuv420p" `
    -af "apad,afade=t=in:st=0:d=0.18,afade=t=out:st=$FadeOut`:d=0.28" `
    -t $DurationText -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k -ar 48000 -movflags +faststart $Segment

  $EscapedSegment = $Segment.Replace("'", "''").Replace('\', '/')
  $ConcatLines += "file '$EscapedSegment'"
}

$ConcatFile = Join-Path $Build 'segments.txt'
$ConcatLines | Set-Content -Path $ConcatFile -Encoding utf8
$Output = Join-Path $Public 'thermosync-institucional.mp4'

# Os segmentos ja possuem os mesmos codecs, portanto a concatenacao final pode
# copiar os fluxos sem nova perda de qualidade e com processamento mais rapido.
& $Ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $ConcatFile -c copy -movflags +faststart $Output

Write-Host "Video institucional gerado em: $Output"
