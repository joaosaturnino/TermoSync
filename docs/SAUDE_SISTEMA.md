# Saude do Sistema

A Central de Saude e a area de observabilidade tecnica do TermoSync. O modulo e restrito ao perfil `DEV` e combina verificacao instantanea, historico persistido e eventos em tempo real.

## Fluxo de dados

1. O backend coleta uma amostra a cada 10 segundos por padrao.
2. A amostra e gravada em `system_health_history`.
3. O evento `system_health_update` e enviado pelo Socket.IO somente para o room `system_health_dev`.
4. A tela atualiza metricas, graficos e feed sem recarregar.
5. Se o socket cair, o frontend ativa o polling HTTP configurado na propria tela.

O ingresso no room tecnico exige um JWT de perfil `DEV` associado a uma sessao ativa e nao revogada em `sessoes_ativas`.

## Dados coletados

- Estado e latencia da API e do banco.
- Estado de MQTT e WhatsApp.
- CPU, RSS, heap, memoria externa e utilizacao do event loop.
- Handles e requests ativos do processo Node.js.
- Quantidade de clientes Socket.IO conectados.
- Memoria e carga media do host.

O workbench permite testar endpoints GET, inspecionar payloads e exportar um bundle. Campos com nomes como token, senha, secret, cookie e QR sao removidos antes da exibicao ou exportacao.

## Banco de dados

A tabela `system_health_history` e criada de forma idempotente no bootstrap de `backend/config/db.js`. Ela possui indices por horario e por estado/horario.

A limpeza de registros vencidos ocorre aproximadamente uma vez por hora. A falha de persistencia nao derruba a API; ela e registrada no log do backend e a proxima coleta continua normalmente.

## Configuracao

Variaveis opcionais do backend:

```env
HEALTH_SAMPLE_INTERVAL_SECONDS=10
HEALTH_HISTORY_RETENTION_DAYS=7
```

O intervalo minimo aceito e 5 segundos. A rota `GET /api/system/health/history` aceita `minutes` entre 5 e 10080 e `limit` entre 10 e 2000, sempre com autenticacao `DEV`.

## Diagnostico

- Confirme `Stream conectado` no painel de runtime.
- Se aparecer `Usando contingencia HTTP`, verifique Socket.IO, CORS e a feature `telemetryStream`.
- Consulte `/api/health` para uma amostra instantanea.
- Consulte `/api/system/health/history?minutes=60&limit=360` para validar a persistencia.
- Verifique a tabela com `SELECT COUNT(*), MAX(recorded_at) FROM system_health_history`.

