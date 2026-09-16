# Guia de Producao do TermoSync

Este guia descreve a rotina minima para subir o sistema com seguranca operacional.

## 1. Variaveis obrigatorias

Copie `.env.example` para `backend/.env` e revise:

- `NODE_ENV=production`
- `PORT`
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` com chave longa e aleatoria
- `CORS_ORIGIN` com o dominio real do frontend
- `IOT_INGEST_TOKEN` para sensores/simuladores
- `MQTT_USERNAME` e `MQTT_PASSWORD`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- SMS: Twilio, Textbee, Textbelt pago ou `SMS_WEBHOOK_URL`
- Backup: `AUTO_BACKUP_ENABLED`, `BACKUP_DIR`, `AUTO_BACKUP_RETENTION`

Nunca publique `.env`, tokens, senhas, QR codes ou backups.

## 2. Verificacao antes de deploy

Na raiz do projeto:

```bash
npm run predeploy
```

Esse comando valida ambiente, sintaxe do backend, lint do frontend e build de producao.

## 3. Backup antes de atualizar

Com o backend rodando e usuario DEV autenticado, use a Central de Saude do Sistema para baixar o backup manual.

Em producao, deixe tambem:

```env
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_INTERVAL_HOURS=24
AUTO_BACKUP_RETENTION=14
BACKUP_DIR=backend/backups
```

Recomendacao: copie `BACKUP_DIR` periodicamente para um disco externo, NAS ou storage cloud.

## 4. Smoke test depois de subir

Depois que o backend estiver online:

```bash
SMOKE_BASE_URL=http://localhost:3000 npm run smoke
```

Troque a URL pelo dominio/porta real do ambiente.

## 5. Checklist operacional

- Login DEV, ADMIN, LOJA e MANUTENCAO validado.
- Recuperacao de senha por e-mail e SMS testada.
- Abertura de OS, comentario, anexo, conclusao e reabertura testados.
- Mobile testado em largura pequena e notebook.
- Sensores ESP32 ou simulador enviando leitura sem `429`.
- MQTT protegido por usuario/senha.
- HTTPS ativo no proxy/domínio.
- CORS restrito ao dominio oficial.
- Backups gerando e sendo copiados para fora do servidor.
- Logs sem erro recorrente no backend.

## 6. Rollback simples

Antes de atualizar:

1. Gere backup manual.
2. Salve a pasta atual ou a tag/commit da versao em uso.
3. Rode `npm run predeploy`.
4. Atualize.
5. Rode `npm run smoke`.

Se falhar, volte a pasta/commit anterior, restaure o backup se necessario e reinicie o backend.
