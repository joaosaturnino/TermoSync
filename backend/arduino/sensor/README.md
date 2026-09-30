# Firmware TermoSync Edge

O firmware canônico do ESP32 é `sensor.ino`. Não mantenha cópias `.jsx` ou sketches na raiz do repositório, pois elas não participam da compilação configurada em `.vscode/arduino.yaml`.

## Preparação

1. Configure `MQTT_USERNAME` e `MQTT_PASSWORD` em `backend/.env`.
2. Execute `npm run firmware:setup`. O comando cria `secrets.h` com as credenciais MQTT do backend e senhas locais aleatórias, sem exibi-las no terminal.
3. Abra `secrets.h` apenas localmente para consultar as senhas do portal, monitor e OTA.
4. Para trocar todas essas senhas, execute `npm run firmware:setup -- --force`.
5. Em produção, configure MQTT TLS (`TERMOSYNC_USE_TLS=1`, porta 8883 e certificado CA).
6. Compile com `npm run verify:sensor` antes de gravar a placa.

Sem `secrets.h`, o firmware opera de forma fail-closed: portal cativo, monitor web e OTA não são disponibilizados sem senhas adequadas, e a autenticação MQTT não possui credenciais para conectar.

## Atuador

`TERMOSYNC_PHYSICAL_ACTUATOR` permanece `0` por padrão. Nesse modo o GPIO 2 representa somente o LED de bancada e a telemetria não afirma que um compressor físico está ligado.

Definir esse valor como `1` exige, antes da energização:

- driver opto-isolado entre ESP32 e potência;
- contator dimensionado para a corrente e categoria da carga;
- proteção elétrica, aterramento e supressão de transientes;
- realimentação independente do estado do contator;
- pressostatos, proteção térmica e intertravamentos que continuem seguros mesmo se o ESP32 travar;
- validação por profissional habilitado.

O software não substitui essas proteções.

## Entrega de telemetria

Cada leitura recebe `leitura_uid`, formado por dispositivo, boot e sequência. A placa mantém o registro na fila até receber ACK em `termosync/ack/{equipamento_id}`. O backend deduplica o UID antes de inserir no banco. Registros mais antigos da flash são enviados antes dos registros da RTC.

Ao atualizar uma versão anterior, a fila binária legada é descartada uma única vez porque o formato v2 adiciona UID e flags de validade.

## Sensores

- O NTC usa média aparada em milivolts, equação Beta, limite físico e rejeição de saltos.
- Uma leitura NTC inválida desliga imediatamente a saída. A falha é consolidada após três ocorrências e exige três leituras válidas para recuperação.
- Falha do DHT envia umidade `null` com `umidade_valida=false`; o backend não transforma a falha em um falso valor de 0%.
- Para instalações sujeitas a condensação, prefira SHT31/SHT35 ou transmissor industrial calibrável em vez do DHT11.

## Banco de dados

Execute `npm run db:migrate:iot` ou permita que o backend crie `telemetria_ingestao`. Essa tabela guarda apenas as chaves idempotentes usadas para impedir leituras duplicadas.
