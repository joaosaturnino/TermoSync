#include <WiFi.h>
#include <PubSubClient.h>
#include <math.h>
#include <DHT.h>
#include <ArduinoOTA.h> 
#include <time.h>            
#include <esp_task_wdt.h>    
#include <WiFiManager.h>     
#include <Preferences.h>     
#include <WebServer.h>
#include <LittleFS.h>
#include <esp_system.h>
#include <esp_timer.h>

/*
  TermoSync Edge - firmware do ESP32

  Este sketch roda na placa instalada junto ao equipamento de refrigeracao. Ele
  tem duas responsabilidades principais:

  1. Loop de hardware no nucleo principal:
     - Le sensores NTC e DHT.
     - Calcula temperatura suavizada.
     - Protege o compressor com anti-ciclo, degelo e modo emergencia.
     - Mantem um buffer offline caso a rede ou MQTT caiam.

  2. Task de rede em outro nucleo:
     - Mantem Wi-Fi, MQTT, OTA e WebServer local.
     - Publica leituras atrasadas quando a comunicacao volta.
     - Recebe comandos remotos vindos do NOC/painel.

  Para manutencao: altere pinos, limites termicos, topicos MQTT e tempos de
  controle somente nesta area de configuracao. Evite mexer na logica de rele sem
  testar fisicamente, pois ela protege o compressor contra partidas curtas.
*/

// Forward declaration para os protótipos automáticos gerados pelo Arduino IDE.
struct LeituraBuffer;

// ==============================================================================
// 1. CONFIGURAÇÕES DA REDE E BROKER MQTT
// ==============================================================================
const char* mqtt_server = "192.168.200.27"; 
const int mqtt_port = 1883;                 
const char* mqtt_topic = "termosync/telemetria";

// Recursos avancados. Mantidos opcionais para preservar compatibilidade com
// instalacoes locais; em producao, o ideal e habilitar autenticacao web/MQTT.
#define WEB_AUTH_ENABLED false
#define MQTT_AUTH_ENABLED true
const char* MQTT_USER_DEFAULT = "termosync_iot";
const char* MQTT_PASS_DEFAULT = "y6jaKDd_YALvVpmN3FDuaIodM3IKtbnr";

// Intervalos e protecoes operacionais. Estes valores evitam flood no backend,
// reconexao agressiva no broker e ciclos muito curtos no compressor.
constexpr uint32_t INTERVALO_TELEMETRIA_MS = 10000UL;
constexpr uint32_t INTERVALO_MQTT_MS = 5000UL;
constexpr uint32_t INTERVALO_HEARTBEAT_MS = 30000UL;
constexpr uint32_t COMPRESSOR_MIN_OFF_MS = 180000UL;
constexpr uint32_t COMPRESSOR_MIN_ON_MS = 60000UL;
constexpr uint8_t NTC_AMOSTRAS = 20;
constexpr uint8_t DHT_MAX_FALHAS_SEGUIDAS = 3;
constexpr uint16_t RTC_BUFFER_CAPACIDADE = 60;
constexpr uint16_t FILE_QUEUE_MAX_REGISTROS = 120;

const char* DEFAULT_PORTAL_PASSWORD = "admin123";
const char* DEFAULT_OTA_PASSWORD = "TermoSync@2026";
const char* DEFAULT_WEB_USER = "admin";
const char* DEFAULT_WEB_PASSWORD = "TermoSync-Edge";
 
// Topicos montados no setup porque dependem do EQUIPAMENTO_ID.
String topico_comandos = ""; 
String topico_status = ""; 

// TLS fica desligado por padrao para redes locais sem certificado. Se ativar,
// preencha MQTT_CA_CERT e confirme que o broker aceita conexao segura.
#define USE_TLS false
#if USE_TLS
  #include <WiFiClientSecure.h>
  const char* MQTT_CA_CERT = R"CERT(
-----BEGIN CERTIFICATE-----
COLOQUE_AQUI_O_CERTIFICADO_CA_DO_BROKER
-----END CERTIFICATE-----
)CERT";
  WiFiClientSecure espClient;
#else
  WiFiClient espClient;
#endif

PubSubClient client(espClient); 

// ==============================================================================
// 2. RECURSOS DO SISTEMA OPERACIONAL E WEB SERIAL
// ==============================================================================
Preferences nvs; 
SemaphoreHandle_t sysMutex; // Protege estado compartilhado entre loop e TaskNetwork.
SemaphoreHandle_t logMutex; // Protege o buffer de logs exibido no Web Monitor.
WebServer server(80);
String webLogBuffer = "";

// Credenciais e identidade sao carregadas da NVS para permitir provisionamento
// em campo sem recompilar o firmware.
String mqttUsuario;
String mqttSenha;
String otaSenha;
String webUsuario;
String webSenha;
String portalSenha;
String deviceUuid;
String motivoUltimoReset = "UNKNOWN";

bool ntcValido = false;
bool dhtValido = false;
bool littleFsDisponivel = false;
bool networkTaskOnline = false;
bool controleManualAtivo = false;

// Contadores persistidos ajudam o painel a diagnosticar instabilidade de rede,
// sensor, MQTT e resets por watchdog.
uint32_t contadorBoot = 0;
uint32_t contadorWatchdog = 0;
uint32_t contadorFalhaWiFi = 0;
uint32_t contadorFalhaMQTT = 0;
uint32_t contadorFalhaNTC = 0;
uint32_t contadorFalhaDHT = 0;
uint32_t contadorComandos = 0;
uint32_t contadorTelemetria = 0;
unsigned long ultimoHeartbeat = 0;
unsigned long instanteLigouCompressor = 0;
unsigned long instanteDesligouCompressor = 0;
uint8_t falhasDHTSeguidas = 0;

enum class ControleEstado : uint8_t {
  NORMAL = 0,
  REFRIGERANDO,
  DEGELO,
  EMERGENCIA,
  FALHA_SENSOR
};
ControleEstado estadoControle = ControleEstado::NORMAL;


void webPrint(String msg) {
  // Todo log vai para Serial e para um buffer curto em RAM, lido via /logs.
  Serial.print(msg);
  if (logMutex != NULL) {
    xSemaphoreTake(logMutex, portMAX_DELAY);
    webLogBuffer += msg;
    if (webLogBuffer.length() > 6144) {
      webLogBuffer = webLogBuffer.substring(webLogBuffer.length() - 4096);
    }
    xSemaphoreGive(logMutex);
  }
}
void webPrintln(String msg = "") {
  webPrint(msg + "\n");
}

// ==============================================================================
// 3. PÁGINA HTML DO MONITOR REMOTO
// ==============================================================================
const String WEBSERIAL_HTML = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThermoSync Edge | Web Monitor</title>
  <style>
    body { background: #020617; color: #cbd5e1; font-family: 'Courier New', monospace; margin: 0; padding: 20px; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; }
    h2 { margin: 0; color: #38bdf8; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    .status { background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: bold; font-size: 0.8rem; }
    .terminal { flex: 1; background: #000; border: 1px solid #1e293b; border-radius: 8px; padding: 15px; overflow-y: auto; box-shadow: inset 0 0 20px rgba(0,0,0,0.8); }
    pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; line-height: 1.4; }
    .btn-clear { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;}
    .btn-clear:hover { background: #ef4444; color: #fff; }
  </style>
  <script>
    async function fetchLogs() {
      try {
        const res = await fetch('/logs');
        if(res.ok) {
          const text = await res.text();
          const term = document.getElementById('terminal');
          const isScrolledToBottom = term.scrollHeight - term.clientHeight <= term.scrollTop + 5;
          document.getElementById('out').textContent = text;
          if(isScrolledToBottom) term.scrollTop = term.scrollHeight;
        }
      } catch(e) {}
    }
    async function clearLogs() {
      await fetch('/clear', {method: 'POST'});
      document.getElementById('out').textContent = '';
    }
    setInterval(fetchLogs, 2000);
    window.onload = fetchLogs;
  </script>
</head>
<body>
  <div class="header">
    <h2>📡 ThermoSync Web Monitor (Live)</h2>
    <div style="display:flex; gap:10px; align-items:center;">
      <span class="status">● ONLINE</span>
      <button class="btn-clear" onclick="clearLogs()">Limpar Tela</button>
    </div>
  </div>
  <div class="terminal" id="terminal">
    <pre id="out">Carregando telemetria ao vivo da máquina...</pre>
  </div>
</body>
</html>
)rawliteral";

// ==============================================================================
// 4. CONFIGURAÇÕES DO EQUIPAMENTO E ATUADORES
// ==============================================================================
const int EQUIPAMENTO_ID = 1; 
const int PINO_RELE = 2;      
const int PINO_VERDE = 25;    
const int PINO_AMARELO = 26;  
const int PINO_VERMELHO = 27; 
const int PINO_BOTAO_RESET = 0; 

float OFFSET_TEMP = 0.0; 
float TEMP_ATENCAO = 26.0; 
float TEMP_CRITICA = 30.0; 
bool bloqueioEmergencia = false;

// Degelo autonomo: desliga o compressor periodicamente por seguranca termica.
unsigned long TEMPO_ENTRE_DEGELOS = 21600000; 
unsigned long DURACAO_DEGELO = 1200000;       
unsigned long ultimoDegelo = 0;
bool estadoDegelo = false;

// ==============================================================================
// 5. CONFIGURAÇÕES DE SENSORES
// ==============================================================================
const int PINO_NTC = 34;                    
const float RESISTOR_SERIE = 9740.0;        
const float RESISTENCIA_NOMINAL = 10000.0;  
const float TEMPERATURA_NOMINAL = 25.0;     
const float COEFICIENTE_BETA = 3435.0;      

#define DHTPIN 4                            
#define DHTTYPE DHT11                       
DHT dht(DHTPIN, DHTTYPE); 

float temperaturaEMA = NAN;                  

// ==============================================================================
// 6. MEMÓRIA OFFLINE ESTRATÉGICA (RAM RTC)
// ==============================================================================
struct LeituraBuffer {
  // Formato compacto usado tanto na RAM RTC quanto no arquivo LittleFS.
  unsigned long timestamp; 
  float temp;
  float umid;
  bool motor;
  bool degelo;
};

RTC_DATA_ATTR LeituraBuffer rtc_bufferOffline[RTC_BUFFER_CAPACIDADE]; 
RTC_DATA_ATTR int bufferHead = 0;  // Proxima posicao de escrita.
RTC_DATA_ATTR int bufferTail = 0;  // Registro mais antigo ainda nao enviado.
RTC_DATA_ATTR int bufferCount = 0; // Quantidade de registros pendentes.

// ==============================================================================
// 6.1 DIAGNÓSTICO, SEGURANÇA E CONTROLE
// ==============================================================================

String resetReasonTexto(esp_reset_reason_t reason) {
  // Traduz o motivo de reset do ESP-IDF para texto simples enviado ao painel.
  switch (reason) {
    case ESP_RST_POWERON: return "POWERON";
    case ESP_RST_SW: return "SOFTWARE";
    case ESP_RST_PANIC: return "PANIC";
    case ESP_RST_INT_WDT: return "INT_WATCHDOG";
    case ESP_RST_TASK_WDT: return "TASK_WATCHDOG";
    case ESP_RST_WDT: return "WATCHDOG";
    case ESP_RST_BROWNOUT: return "BROWNOUT";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
    case ESP_RST_EXT: return "EXTERNAL";
    default: return "UNKNOWN";
  }
}

String estadoControleTexto() {
  // Mantem os nomes dos estados estaveis para logs, /health e payload MQTT.
  switch (estadoControle) {
    case ControleEstado::NORMAL: return "NORMAL";
    case ControleEstado::REFRIGERANDO: return "REFRIGERANDO";
    case ControleEstado::DEGELO: return "DEGELO";
    case ControleEstado::EMERGENCIA: return "EMERGENCIA";
    case ControleEstado::FALHA_SENSOR: return "FALHA_SENSOR";
    default: return "UNKNOWN";
  }
}

void salvarContador(const char* chave, uint32_t valor) {
  // Evita desgaste da flash: contadores muito ruidosos sao persistidos nos
  // primeiros eventos e depois em blocos. O valor em RAM continua exato.
  if (valor > 5 && valor % 10 != 0) return;
  nvs.putUInt(chave, valor);
}

void carregarDiagnosticos() {
  // Carrega contadores historicos da NVS e registra o motivo do ultimo boot.
  // Isso facilita diferenciar falha eletrica, queda de rede e watchdog.
  deviceUuid = WiFi.macAddress();
  deviceUuid.replace(":", "");

  motivoUltimoReset = resetReasonTexto(esp_reset_reason());
  contadorBoot = nvs.getUInt("boot_count", 0) + 1;
  contadorWatchdog = nvs.getUInt("wdt_count", 0);
  contadorFalhaWiFi = nvs.getUInt("wifi_fail", 0);
  contadorFalhaMQTT = nvs.getUInt("mqtt_fail", 0);
  contadorFalhaNTC = nvs.getUInt("ntc_fail", 0);
  contadorFalhaDHT = nvs.getUInt("dht_fail", 0);
  contadorComandos = nvs.getUInt("cmd_count", 0);

  nvs.putUInt("boot_count", contadorBoot);

  if (motivoUltimoReset == "TASK_WATCHDOG" ||
      motivoUltimoReset == "INT_WATCHDOG" ||
      motivoUltimoReset == "WATCHDOG") {
    contadorWatchdog++;
    nvs.putUInt("wdt_count", contadorWatchdog);
  }

  webPrintln("[DIAG] UUID: " + deviceUuid);
  webPrintln("[DIAG] Boot: #" + String(contadorBoot));
  webPrintln("[DIAG] Reset anterior: " + motivoUltimoReset);
}

void carregarCredenciais() {
  // Valores gravados na NVS sobrescrevem os defaults. Assim o tecnico pode
  // trocar senhas em campo sem alterar o codigo-fonte.
  mqttUsuario = nvs.getString("mqtt_user", "");
  mqttSenha = nvs.getString("mqtt_pass", "");
  otaSenha = nvs.getString("ota_pass", DEFAULT_OTA_PASSWORD);
  webUsuario = nvs.getString("web_user", DEFAULT_WEB_USER);
  webSenha = nvs.getString("web_pass", DEFAULT_WEB_PASSWORD);
  portalSenha = nvs.getString("portal_pass", DEFAULT_PORTAL_PASSWORD);
}

bool jsonTemAcao(const String& json, const char* acao) {
  // Parser minimo para comandos simples. Foi mantido sem biblioteca JSON para
  // reduzir dependencias e consumo de heap no ESP32.
  int pos = json.indexOf("\"acao\"");
  if (pos < 0) return false;

  pos = json.indexOf(':', pos + 6);
  if (pos < 0) return false;
  pos++;

  while (pos < (int)json.length() && isspace((unsigned char)json[pos])) pos++;
  if (pos >= (int)json.length() || json[pos] != '"') return false;
  pos++;

  String valor;
  valor.reserve(32);
  while (pos < (int)json.length() && json[pos] != '"') {
    if (json[pos] == '\\' && pos + 1 < (int)json.length()) pos++;
    valor += json[pos++];
  }

  return valor == acao;
}

bool extrairNumeroJson(const String& json, const char* chave, float& valor) {
  // Extrai apenas numeros de campos conhecidos usados em CONFIG. Campos
  // invalidos sao ignorados para evitar configurar limites perigosos.
  String token = "\"";
  token += chave;
  token += "\"";

  int pos = json.indexOf(token);
  if (pos < 0) return false;

  pos = json.indexOf(':', pos + token.length());
  if (pos < 0) return false;
  pos++;

  while (pos < (int)json.length() && isspace((unsigned char)json[pos])) pos++;

  int inicio = pos;
  while (pos < (int)json.length()) {
    char c = json[pos];
    if (!(isdigit((unsigned char)c) || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E')) break;
    pos++;
  }

  if (pos <= inicio) return false;

  String numero = json.substring(inicio, pos);
  char* fim = nullptr;
  float convertido = strtof(numero.c_str(), &fim);
  if (fim == numero.c_str() || !isfinite(convertido)) return false;

  valor = convertido;
  return true;
}

bool compressorPodeLigar(unsigned long agora) {
  // Anti-ciclo: impede religar o compressor logo apos desligar.
  return instanteDesligouCompressor == 0 || (agora - instanteDesligouCompressor >= COMPRESSOR_MIN_OFF_MS);
}

bool compressorPodeDesligar(unsigned long agora) {
  // Tempo minimo ligado: evita chaveamento rapido quando a temperatura oscila.
  return instanteLigouCompressor == 0 || (agora - instanteLigouCompressor >= COMPRESSOR_MIN_ON_MS);
}

void aplicarEstadoRele(bool ligado, bool forcar = false) {
  // Unico ponto recomendado para alterar o rele em operacao normal. Centraliza
  // as protecoes do compressor e registra o instante da ultima troca.
  const bool atual = digitalRead(PINO_RELE);
  if (atual == ligado) return;

  unsigned long agora = millis();
  if (!forcar && ligado && !compressorPodeLigar(agora)) {
    webPrintln("[PROTEÇÃO] Partida do compressor bloqueada pelo anti-ciclo.");
    return;
  }
  if (!forcar && !ligado && !compressorPodeDesligar(agora)) {
    webPrintln("[PROTEÇÃO] Desligamento retardado pelo anti-ciclo.");
    return;
  }

  digitalWrite(PINO_RELE, ligado ? HIGH : LOW);
  if (ligado) instanteLigouCompressor = agora;
  else instanteDesligouCompressor = agora;
}

void desligarReleEmergencia() {
  // Caminho direto e seguro usado em falha de sensor, degelo, OTA e emergencia.
  digitalWrite(PINO_RELE, LOW);
  instanteDesligouCompressor = millis();
}

void inicializarLittleFS() {
  // LittleFS e usado como segunda camada de fila offline quando a RAM RTC lota.
  littleFsDisponivel = LittleFS.begin(false);
  webPrintln(littleFsDisponivel ? "[FS] LittleFS online." : "[FS] LittleFS indisponível; RTC continua como buffer.");
}

void arquivarRegistroFlash(const LeituraBuffer& registro) {
  // Guarda o registro mais antigo em flash quando a fila RTC esta cheia.
  // O limite evita crescimento indefinido e desgaste excessivo da memoria.
  if (!littleFsDisponivel) return;
  File f = LittleFS.open("/termosync_offline.bin", FILE_APPEND);
  if (!f) return;

  const size_t maxBytes = FILE_QUEUE_MAX_REGISTROS * sizeof(LeituraBuffer);
  if (f.size() >= maxBytes) {
    f.close();
    return;
  }

  f.write(reinterpret_cast<const uint8_t*>(&registro), sizeof(LeituraBuffer));
  f.close();
}

bool lerRegistroFlash(LeituraBuffer& registro) {
  // Le sempre o primeiro registro do arquivo, preservando ordem cronologica.
  if (!littleFsDisponivel || !LittleFS.exists("/termosync_offline.bin")) return false;
  File f = LittleFS.open("/termosync_offline.bin", FILE_READ);
  if (!f || f.size() < sizeof(LeituraBuffer)) {
    if (f) f.close();
    return false;
  }
  size_t bytes = f.read(reinterpret_cast<uint8_t*>(&registro), sizeof(LeituraBuffer));
  f.close();
  return bytes == sizeof(LeituraBuffer);
}

void consumirPrimeiroRegistroFlash() {
  // Remove o primeiro registro apos publicacao MQTT confirmada. Como LittleFS
  // nao remove bytes do inicio, regrava o restante em arquivo temporario.
  if (!littleFsDisponivel || !LittleFS.exists("/termosync_offline.bin")) return;

  File src = LittleFS.open("/termosync_offline.bin", FILE_READ);
  if (!src) return;
  size_t total = src.size();

  if (total <= sizeof(LeituraBuffer)) {
    src.close();
    LittleFS.remove("/termosync_offline.bin");
    return;
  }

  File dst = LittleFS.open("/termosync_tmp.bin", FILE_WRITE);
  if (!dst) { src.close(); return; }

  src.seek(sizeof(LeituraBuffer));
  uint8_t buf[128];
  size_t restante = total - sizeof(LeituraBuffer);
  while (restante > 0) {
    size_t bloco = restante > sizeof(buf) ? sizeof(buf) : restante;
    size_t lido = src.read(buf, bloco);
    if (lido == 0) break;
    dst.write(buf, lido);
    restante -= lido;
  }
  src.close();
  dst.close();

  LittleFS.remove("/termosync_offline.bin");
  LittleFS.rename("/termosync_tmp.bin", "/termosync_offline.bin");
}

String gerarHealthJson() {
  // Snapshot leve para o painel de desenvolvimento consultar o estado da placa.
  String json = "{";
  json += "\"equipamento_id\":" + String(EQUIPAMENTO_ID) + ",";
  json += "\"device_uuid\":\"" + deviceUuid + "\",";
  json += "\"estado\":\"" + estadoControleTexto() + "\",";
  json += "\"rele\":" + String(digitalRead(PINO_RELE) ? "true" : "false") + ",";
  json += "\"controle_manual\":" + String(controleManualAtivo ? "true" : "false") + ",";
  json += "\"wifi_ok\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"mqtt_ok\":" + String(client.connected() ? "true" : "false") + ",";
  json += "\"ntc_ok\":" + String(ntcValido ? "true" : "false") + ",";
  json += "\"dht_ok\":" + String(dhtValido ? "true" : "false") + ",";
  json += "\"rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127) + ",";
  json += "\"heap_livre\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"heap_minimo\":" + String(ESP.getMinFreeHeap()) + ",";
  json += "\"boots\":" + String(contadorBoot) + ",";
  json += "\"watchdog_resets\":" + String(contadorWatchdog) + ",";
  json += "\"falhas_wifi\":" + String(contadorFalhaWiFi) + ",";
  json += "\"falhas_mqtt\":" + String(contadorFalhaMQTT) + ",";
  json += "\"falhas_ntc\":" + String(contadorFalhaNTC) + ",";
  json += "\"falhas_dht\":" + String(contadorFalhaDHT) + ",";
  json += "\"ultimo_reset\":\"" + motivoUltimoReset + "\"";
  json += "}";
  return json;
}

void publicarHeartbeat() {
  // Status retido no MQTT permite que o backend saiba rapidamente se o hardware
  // esta online mesmo quando nao ha leitura nova.
  if (!client.connected()) return;

  unsigned long agora = millis();
  if (agora - ultimoHeartbeat < INTERVALO_HEARTBEAT_MS) return;
  ultimoHeartbeat = agora;

  String json = "{";
  json += "\"equipamento_id\":" + String(EQUIPAMENTO_ID) + ",";
  json += "\"device_uuid\":\"" + deviceUuid + "\",";
  json += "\"status\":\"ONLINE\",";
  json += "\"estado\":\"" + estadoControleTexto() + "\",";
  json += "\"uptime_ms\":" + String(millis()) + ",";
  json += "\"heap_livre\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"rssi\":" + String(WiFi.RSSI());
  json += "}";

  client.publish(topico_status.c_str(), json.c_str(), true);
}

// ==============================================================================
// 7. CALLBACK MQTT (COMANDOS NOC)
// ==============================================================================
void callback(char* topic, byte* payload, unsigned int length) {
  // Processa comandos recebidos pelo topico termosync/comandos/{equipamento}.
  // Cada acao deve terminar com return para evitar executar mais de um comando.
  (void)topic;

  String mensagem;
  mensagem.reserve(length + 1);
  for (unsigned int i = 0; i < length; ++i) mensagem += static_cast<char>(payload[i]);

  contadorComandos++;
  salvarContador("cmd_count", contadorComandos);

  if (jsonTemAcao(mensagem, "CONFIG")) {
    float novaCritica = NAN;
    float novaAtencao = NAN;
    float novoOffset = NAN;

    extrairNumeroJson(mensagem, "temp_critica", novaCritica);
    extrairNumeroJson(mensagem, "temp_atencao", novaAtencao);
    extrairNumeroJson(mensagem, "offset_temp", novoOffset);

    xSemaphoreTake(sysMutex, portMAX_DELAY);
    if (isfinite(novaCritica)) TEMP_CRITICA = constrain(novaCritica, -40.0f, 80.0f);
    if (isfinite(novaAtencao)) TEMP_ATENCAO = constrain(novaAtencao, -40.0f, 80.0f);
    if (isfinite(novoOffset)) OFFSET_TEMP = constrain(novoOffset, -20.0f, 20.0f);
    if (TEMP_CRITICA <= TEMP_ATENCAO) TEMP_CRITICA = TEMP_ATENCAO + 2.0f;
    nvs.putFloat("t_critica", TEMP_CRITICA);
    nvs.putFloat("t_atencao", TEMP_ATENCAO);
    nvs.putFloat("t_offset", OFFSET_TEMP);
    xSemaphoreGive(sysMutex);

    webPrintln("[NVS] Configuração térmica atualizada e validada.");
    return;
  }

  if (jsonTemAcao(mensagem, "REBOOT")) {
    webPrintln("[AÇÃO] Reinício remoto solicitado.");
    vTaskDelay(pdMS_TO_TICKS(500));
    ESP.restart();
    return;
  }

  if (jsonTemAcao(mensagem, "DESLIGAMENTO_EMERGENCIA")) {
    xSemaphoreTake(sysMutex, portMAX_DELAY);
    bloqueioEmergencia = true;
    estadoControle = ControleEstado::EMERGENCIA;
    desligarReleEmergencia();
    xSemaphoreGive(sysMutex);
    webPrintln("[EMERGÊNCIA] Compressor desligado e bloqueado.");
    return;
  }

  if (jsonTemAcao(mensagem, "LIBERAR_EMERGENCIA")) {
    xSemaphoreTake(sysMutex, portMAX_DELAY);
    bloqueioEmergencia = false;
    controleManualAtivo = false;
    estadoControle = ControleEstado::NORMAL;
    xSemaphoreGive(sysMutex);
    webPrintln("[SEGURANÇA] Bloqueio de emergência liberado.");
    return;
  }

  if (jsonTemAcao(mensagem, "MANUAL_RELE")) {
    xSemaphoreTake(sysMutex, portMAX_DELAY);
    if (bloqueioEmergencia || estadoDegelo) {
      xSemaphoreGive(sysMutex);
      webPrintln("[AÇÃO] Manual recusado: emergência ou degelo ativo.");
      return;
    }
    bool novoEstado = !digitalRead(PINO_RELE);
    aplicarEstadoRele(novoEstado);
    controleManualAtivo = (digitalRead(PINO_RELE) == novoEstado);
    xSemaphoreGive(sysMutex);
    webPrintln(controleManualAtivo
      ? "[AÇÃO] Relé alterado e controle manual ativado."
      : "[AÇÃO] Comando manual não executado por proteção do compressor.");
    return;
  }

  if (jsonTemAcao(mensagem, "AUTO_RELE")) {
    xSemaphoreTake(sysMutex, portMAX_DELAY);
    controleManualAtivo = false;
    estadoControle = ControleEstado::NORMAL;
    xSemaphoreGive(sysMutex);
    webPrintln("[AÇÃO] Controle automático do relé restaurado.");
    return;
  }

  if (jsonTemAcao(mensagem, "OTA")) {
    webPrintln("[OTA] Comando recebido; serviço OTA permanece sob controle do ArduinoOTA.");
    return;
  }
}

// 8. GERADOR DE PAYLOAD JSON
// ==============================================================================
String gerarPayload(float t, float u, bool m, bool emDegelo, String alerta, unsigned long ts) {
  // Payload principal enviado ao backend via MQTT. Inclui leitura, contexto de
  // controle, saude da placa e sequencia para facilitar auditoria de perdas.
  String ipStr = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : String("OFFLINE");
  String payload;
  payload.reserve(900);

  payload += "{";
  payload += "\"equipamento_id\":" + String(EQUIPAMENTO_ID) + ",";
  payload += "\"timestamp\":" + String(ts) + ",";
  payload += "\"temperatura\":" + String(t, 2) + ",";
  payload += "\"temperatura_valida\":" + String(ntcValido ? "true" : "false") + ",";
  payload += "\"umidade\":" + String(u, 1) + ",";
  payload += "\"umidade_valida\":" + String(dhtValido ? "true" : "false") + ",";
  payload += "\"consumo_kwh\":0.0,";
  payload += "\"motor_ligado\":" + String(m ? "true" : "false") + ",";
  payload += "\"em_degelo\":" + String(emDegelo ? "true" : "false") + ",";
  payload += "\"bloqueio_emergencia\":" + String(bloqueioEmergencia ? "true" : "false") + ",";
  payload += "\"estado_controle\":\"" + estadoControleTexto() + "\",";
  payload += "\"controle_manual\":" + String(controleManualAtivo ? "true" : "false") + ",";
  payload += "\"alerta_forcado\":\"" + alerta + "\",";
  payload += "\"mac_address\":\"" + WiFi.macAddress() + "\",";
  payload += "\"device_uuid\":\"" + deviceUuid + "\",";
  payload += "\"ip_local\":\"" + ipStr + "\",";
  payload += "\"sinal_wifi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127) + ",";
  payload += "\"wifi_ok\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  payload += "\"mqtt_ok\":" + String(client.connected() ? "true" : "false") + ",";
  payload += "\"heap_livre\":" + String(ESP.getFreeHeap()) + ",";
  payload += "\"heap_minimo\":" + String(ESP.getMinFreeHeap()) + ",";
  payload += "\"sequencia\":" + String(++contadorTelemetria) + ",";
  payload += "\"boots\":" + String(contadorBoot) + ",";
  payload += "\"ultimo_reset\":\"" + motivoUltimoReset + "\",";
  payload += "\"firmware_version\":\"v13.3-Enterprise-Edge\"";
  payload += "}";

  return payload;
}

// 9. TAREFA DO NÚCLEO 0 (REDE, MQTT, OTA E SERVIDOR WEBSERIAL)
// ==============================================================================
void TaskNetwork(void *pvParameters) {
  // Esta task roda separada do loop de hardware. Assim, reconexao MQTT, OTA e
  // servidor web nao atrasam a leitura dos sensores nem o controle do rele.
  #if USE_TLS
    espClient.setCACert(MQTT_CA_CERT);
  #endif

  WiFi.mode(WIFI_STA);
  // Sleep desligado melhora estabilidade de MQTT/OTA em ambientes industriais.
  WiFi.setSleep(false); 
  WiFi.config(IPAddress(0,0,0,0), IPAddress(0,0,0,0), IPAddress(0,0,0,0));

  // =========================================================================
  // PORTAL CATIVO CUSTOMIZADO DE ALTO NÍVEL (HTML/CSS INJECTION)
  // =========================================================================
  WiFiManager wm;
  wm.setDebugOutput(false); 
  // Se nao configurar Wi-Fi em 3 minutos, a placa segue offline e continua
  // controlando o equipamento localmente.
  wm.setConfigPortalTimeout(180); 

  // Injetando CSS Cibernético Extremamente Polido
  String customCSS = "<style>"
    "body{background:#020617;color:#cbd5e1;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;display:flex;justify-content:center;padding-top:20px;margin:0;}"
    ".wrap{max-width:420px;width:90%;margin:0 auto;padding:35px 25px;background:linear-gradient(145deg,#0b1120 0%,#020617 100%);border:1px solid rgba(56,189,248,0.2);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.9),inset 0 0 20px rgba(56,189,248,0.05);}"
    "h1{color:#fff;font-size:2em;margin-top:0;margin-bottom:5px;font-weight:900;text-align:center;text-shadow:0 0 15px rgba(56,189,248,0.4);}"
    "h1 span{color:#38bdf8;}"
    "h3{color:#64748b;font-size:0.85em;text-transform:uppercase;letter-spacing:1px;margin-top:0;margin-bottom:25px;text-align:center;}"
    "button{background:#10b981;color:#020617;border:1px solid #10b981;border-radius:8px;padding:15px;font-weight:900;width:100%;margin-top:10px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:0.3s;box-shadow:0 4px 15px rgba(16,185,129,0.2);}"
    "button:hover{background:#059669;box-shadow:0 6px 20px rgba(16,185,129,0.4);transform:translateY(-2px);}"
    "input{background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:14px;border-radius:8px;width:100%;box-sizing:border-box;margin-bottom:15px;outline:none;text-align:center;font-size:1em;transition:0.3s;}"
    "input:focus{border-color:#38bdf8;background:rgba(0,0,0,0.8);box-shadow:0 0 15px rgba(56,189,248,0.2);}"
    "a{color:#38bdf8;text-decoration:none;font-weight:700;display:block;margin-top:15px;text-align:center;transition:0.3s;}"
    "a:hover{color:#7dd3fc;text-shadow:0 0 10px rgba(56,189,248,0.4);}"
    ".q{display:none;}" /* Esconde o logo padrão "W" do WiFiManager */
    ".msg{background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:10px;border-radius:8px;font-weight:bold;margin-bottom:15px;text-align:center;font-size:0.85em;}"
    "</style>";

  // Injetando um título personalizado (Ícone + Texto Colorido)
  String customMenuHTML = "<div style=\"text-align:center;font-size:40px;margin-bottom:5px;text-shadow:0 0 15px #38bdf8;\">📡</div>"
                          "<h1>Termo<span>Sync</span></h1>"
                          "<h3>Terminal de Configuração IoT</h3>";

  wm.setCustomHeadElement(customCSS.c_str());
  wm.setCustomMenuHTML(customMenuHTML.c_str());

  webPrintln("[WIFI] Iniciando Gestor de Conexão Customizado...");

  if (!wm.autoConnect("TermoSync-Config", portalSenha.c_str())) {
    webPrintln("[WIFI] Falha ao conectar (Timeout). Trabalhando Offline.");
  } else {
    webPrintln("[WIFI] Conectado na rede local com sucesso!");
  }

  bool servicosRedeIniciados = false;

  server.on("/", HTTP_GET, []() {
    // Monitor local embarcado para manutencao em campo. Pode ser protegido
    // habilitando WEB_AUTH_ENABLED no topo do arquivo.
    #if WEB_AUTH_ENABLED
      if (!server.authenticate(webUsuario.c_str(), webSenha.c_str())) {
        server.requestAuthentication();
        return;
      }
    #endif
    server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    server.send(200, "text/html; charset=utf-8", WEBSERIAL_HTML);
  });

  server.on("/health", HTTP_GET, []() {
    // Endpoint JSON usado pelo Painel Desenvolvedor para verificar vida,
    // sinal Wi-Fi, sensores, heap e estado do controle.
    #if WEB_AUTH_ENABLED
      if (!server.authenticate(webUsuario.c_str(), webSenha.c_str())) {
        server.requestAuthentication();
        return;
      }
    #endif
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    server.send(200, "application/json; charset=utf-8", gerarHealthJson());
  });
  
  // ADIÇÃO IMPORTANTE: Cabeçalho CORS para permitir que o React leia os dados
  server.on("/logs", HTTP_GET, []() {
    // Logs em texto puro para o painel web. Mantem CORS aberto porque o painel
    // React pode rodar em outro host/porta durante diagnostico local.
    #if WEB_AUTH_ENABLED
      if (!server.authenticate(webUsuario.c_str(), webSenha.c_str())) {
        server.requestAuthentication();
        return;
      }
    #endif
    server.sendHeader("Access-Control-Allow-Origin", "*");
    xSemaphoreTake(logMutex, portMAX_DELAY);
    String out = webLogBuffer;
    xSemaphoreGive(logMutex);
    server.send(200, "text/plain; charset=utf-8", out);
  });
  
  server.on("/clear", HTTP_POST, []() {
    // Limpa apenas o buffer em RAM do monitor web; nao altera diagnosticos NVS.
    #if WEB_AUTH_ENABLED
      if (!server.authenticate(webUsuario.c_str(), webSenha.c_str())) {
        server.requestAuthentication();
        return;
      }
    #endif
    server.sendHeader("Access-Control-Allow-Origin", "*");
    xSemaphoreTake(logMutex, portMAX_DELAY);
    webLogBuffer = "";
    xSemaphoreGive(logMutex);
    server.send(200, "text/plain", "OK");
  });

  esp_task_wdt_add(NULL); 
  configTime(-10800, 0, "pool.ntp.org", "time.nist.gov"); 
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback); 
  // FIX: Aumentando o tamanho do buffer MQTT para suportar payloads maiores (JSON com diagnósticos)
  client.setBufferSize(2048); 

  unsigned long lastReconnect = 0;

  for(;;) {
    esp_task_wdt_reset(); 

    if (WiFi.status() != WL_CONNECTED) {
       // Quando o Wi-Fi cai, nao bloqueia o controle fisico: tenta reconectar,
       // marca rede offline e volta depois de um intervalo fixo.
       servicosRedeIniciados = false; 
       WiFi.reconnect();
       networkTaskOnline = false;
       contadorFalhaWiFi++;
       salvarContador("wifi_fail", contadorFalhaWiFi);
       networkTaskOnline = false;
       vTaskDelay(pdMS_TO_TICKS(5000));
       continue;
    }

    if (!servicosRedeIniciados && WiFi.localIP()[0] != 0) {
       // Inicializa WebServer e OTA apenas depois que a pilha de rede recebeu IP.
       server.begin();
       webPrintln("🌐 [WEB] Monitor Serial Remoto Online! IP: " + WiFi.localIP().toString());
       
       ArduinoOTA.setHostname("TermoSync-Edge-01");
       ArduinoOTA.setPassword(otaSenha.c_str()); 
       
       ArduinoOTA.onStart([]() {
         desligarReleEmergencia();
         webPrintln("\n🚀 [OTA] Recebendo nova atualização pelo ar...");
       });
       ArduinoOTA.onEnd([]() {
         webPrintln("\n✅ [OTA] Upload finalizado com sucesso! Reiniciando...");
       });
       ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
         esp_task_wdt_reset(); 
         unsigned int percentual = total > 0 ? (progress * 100U) / total : 0;
         Serial.printf("⏳ [OTA] Progresso: %u%%\r", percentual);
       });
       ArduinoOTA.onError([](ota_error_t error) {
         Serial.printf("❌ [OTA] ERRO FATAL [%u]: ", error);
         if (error == OTA_AUTH_ERROR) Serial.println("Falha de Autenticação");
         else if (error == OTA_BEGIN_ERROR) Serial.println("Espaço insuficiente na Flash");
         else if (error == OTA_CONNECT_ERROR) Serial.println("Conexão com IDE perdida");
         else if (error == OTA_RECEIVE_ERROR) Serial.println("Timeout no recebimento");
         else if (error == OTA_END_ERROR) Serial.println("Falha ao finalizar gravação");
       });

       ArduinoOTA.begin();
       servicosRedeIniciados = true;
       webPrintln("🚀 [OTA] Serviço de Atualização pelo Ar Ativo e Seguro!");
    }

    if (servicosRedeIniciados) {
       ArduinoOTA.handle();
       server.handleClient(); 
    }

    if (!client.connected()) {
      if (millis() - lastReconnect >= INTERVALO_MQTT_MS) {
        // Backoff simples para evitar loop agressivo de conexao no broker.
        lastReconnect = millis();
        String clientId = "TermoSyncEdge-" + String((uint32_t)ESP.getEfuseMac(), HEX);
        
        String lwtPayload = "{\"equipamento_id\":" + String(EQUIPAMENTO_ID) + ",\"status\":\"OFFLINE\"}";
        
        const char* mqttUserPtr = nullptr;
        const char* mqttPassPtr = nullptr;
        if (MQTT_AUTH_ENABLED) {
          mqttUserPtr = mqttUsuario.length() ? mqttUsuario.c_str() : MQTT_USER_DEFAULT;
          mqttPassPtr = mqttSenha.length() ? mqttSenha.c_str() : MQTT_PASS_DEFAULT;
        }

        if (client.connect(clientId.c_str(), mqttUserPtr, mqttPassPtr, topico_status.c_str(), 1, true, lwtPayload.c_str())) {
          // LWT publica OFFLINE automaticamente se a placa cair sem desconectar.
          client.subscribe(topico_comandos.c_str());
          
          String onlinePayload = "{\"equipamento_id\":" + String(EQUIPAMENTO_ID) + ",\"status\":\"ONLINE\"}";
          client.publish(topico_status.c_str(), onlinePayload.c_str(), true);
          client.publish((String("termosync/hardware/") + EQUIPAMENTO_ID + "/pedir_config").c_str(), "{}");
          
          webPrintln("🔗 [MQTT] Reconectado ao Broker Master com Sucesso!");
        } else {
          contadorFalhaMQTT++;
          salvarContador("mqtt_fail", contadorFalhaMQTT);
        }
      }
    } else {
      client.loop();
      publicarHeartbeat();
      networkTaskOnline = client.connected();

      // Primeiro escoa a fila RTC criada pelo loop principal. Isso preserva a
      // ordem das leituras e evita perda quando a rede retorna.
      bool temDados = false;
      uint16_t dadosPendentes = 0;
      LeituraBuffer dadoAtrasado;

      xSemaphoreTake(sysMutex, portMAX_DELAY);
      if (bufferCount > 0) {
        temDados = true;
        dadosPendentes = (uint16_t)bufferCount;
        dadoAtrasado = rtc_bufferOffline[bufferTail];
      }
      xSemaphoreGive(sysMutex);

      if (temDados) {
        String alerta = dadosPendentes > 1 ? "RECUPERACAO_OFFLINE" : "NENHUM";
        String offPayload = gerarPayload(dadoAtrasado.temp, dadoAtrasado.umid, dadoAtrasado.motor, dadoAtrasado.degelo, alerta, dadoAtrasado.timestamp);
        
        if (client.publish(mqtt_topic, offPayload.c_str())) {
          xSemaphoreTake(sysMutex, portMAX_DELAY);
          bufferTail = (bufferTail + 1) % RTC_BUFFER_CAPACIDADE;
          bufferCount--;
          xSemaphoreGive(sysMutex);
          
          if (bufferCount > 0) {
            webPrintln("📡 [WIFI] Sincronizando dados atrasados. Restam: " + String(bufferCount));
          } else {
            webPrintln("📡 [MQTT] Dados enviados para a nuvem com sucesso!");
          }
        } else {
          webPrintln("⚠️ [MQTT] ERRO ao publicar payload na nuvem.");
        }
        vTaskDelay(pdMS_TO_TICKS(200));
      } else if (littleFsDisponivel) {
        // Depois da RAM RTC, tenta recuperar registros antigos que foram
        // derramados para flash quando a fila em memoria ficou cheia.
        LeituraBuffer flashRegistro;
        if (lerRegistroFlash(flashRegistro)) {
          String flashPayload = gerarPayload(flashRegistro.temp, flashRegistro.umid, flashRegistro.motor, flashRegistro.degelo, "RECUPERACAO_FLASH", flashRegistro.timestamp);
          if (client.publish(mqtt_topic, flashPayload.c_str())) consumirPrimeiroRegistroFlash();
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10)); 
  }
}

// ==============================================================================
// 10. FUNÇÃO DE LEITURA (FILTRO EMA + OFFSET METROLÓGICO)
// ==============================================================================
float lerTemperaturaSuavizada() {
  // Le o NTC varias vezes para reduzir ruido eletrico, converte pela equacao
  // Beta e aplica EMA + offset de calibracao vindo da NVS/MQTT.
  long somaADC = 0;
  for (uint8_t i = 0; i < NTC_AMOSTRAS; i++) {
    somaADC += analogRead(PINO_NTC);
    delay(2);
  }
  float leituraADC = somaADC / (float)NTC_AMOSTRAS;

  if (leituraADC <= 0 || leituraADC >= 4095) { ntcValido = false; return NAN; } 
  float resistencia = RESISTOR_SERIE * ((4095.0 / leituraADC) - 1.0);
  if (resistencia <= 0 || !isfinite(resistencia)) { ntcValido = false; return NAN; }

  float tempAtual = (1.0 / ((1.0 / (TEMPERATURA_NOMINAL + 273.15)) + (log(resistencia / RESISTENCIA_NOMINAL) / COEFICIENTE_BETA))) - 273.15;

  if (isnan(temperaturaEMA)) {
    temperaturaEMA = tempAtual; 
  } else {
    temperaturaEMA = (0.15 * tempAtual) + (0.85 * temperaturaEMA);
  }
  
  xSemaphoreTake(sysMutex, portMAX_DELAY);
  float offsetSeguro = OFFSET_TEMP;
  xSemaphoreGive(sysMutex);
  
  const float temperaturaFinal = temperaturaEMA + offsetSeguro;
  ntcValido = isfinite(temperaturaFinal);
  return temperaturaFinal;
}

// ==============================================================================
// 11. SETUP (NÚCLEO 1)
// ==============================================================================
void setup() {
  // Inicializacao unica da placa: logs, NVS, watchdog, pinos, sensores, filas
  // e task de rede. Se algum recurso essencial falhar, reinicia em modo seguro.
  Serial.begin(115200);
  delay(1000);

  logMutex = xSemaphoreCreateMutex(); 
  
  webPrintln("\n==================================================");
  webPrintln("  TermoSync Edge - V13.2 Enterprise (Wi-Fi Pro)");
  webPrintln("==================================================");

  sysMutex = xSemaphoreCreateMutex();
  if (sysMutex == NULL || logMutex == NULL) {
    Serial.println("FATAL: falha ao criar mutexes.");
    delay(1000);
    ESP.restart();
  }
  pinMode(PINO_BOTAO_RESET, INPUT_PULLUP);

  if (!nvs.begin("termosync", false)) {
    Serial.println("FATAL: falha ao abrir NVS.");
    delay(1000);
    ESP.restart();
  }
  TEMP_ATENCAO = constrain(nvs.getFloat("t_atencao", 26.0), -40.0f, 80.0f);
  TEMP_CRITICA = constrain(nvs.getFloat("t_critica", 30.0), -40.0f, 80.0f);
  OFFSET_TEMP  = constrain(nvs.getFloat("t_offset", 0.0), -20.0f, 20.0f);
  if (TEMP_CRITICA <= TEMP_ATENCAO) TEMP_CRITICA = TEMP_ATENCAO + 2.0f;
  carregarCredenciais();
  carregarDiagnosticos();
  webPrintln("[NVS] Parâmetros, credenciais e diagnóstico carregados.");

  esp_task_wdt_config_t wdt_config = {
    // Watchdog intencionalmente agressivo: se uma task travar, o ESP32 reinicia
    // e registra o motivo no proximo boot.
    .timeout_ms = 30000, 
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL); 

  topico_comandos = "termosync/comandos/" + String(EQUIPAMENTO_ID);
  topico_status   = "termosync/hardware/status"; 

  pinMode(PINO_RELE, OUTPUT);
  digitalWrite(PINO_RELE, LOW);
  pinMode(PINO_VERDE, OUTPUT); pinMode(PINO_AMARELO, OUTPUT); pinMode(PINO_VERMELHO, OUTPUT);
  digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(PINO_NTC, ADC_11db); 

  dht.begin();
  inicializarLittleFS();
  ultimoDegelo = millis(); 

  xTaskCreatePinnedToCore(
    // Rede no core 0 deixa o loop principal livre para hardware/controle.
    TaskNetwork, "NetworkTask", 16384, NULL, 1, NULL, 0 
  );
}

// ==============================================================================
// 12. LOOP PRINCIPAL (NÚCLEO 1 - DEDICADO A HARDWARE E PRODUTOR)
// ==============================================================================
void loop() {
  // Loop principal: nunca deve esperar rede. Ele cuida de sensores, rele,
  // degelo, LEDs e producao da telemetria local.
  unsigned long now = millis(); 
  static unsigned long lastMsgTime = 0; 
  esp_task_wdt_reset(); 

  // ============================================================================
  // ROTINA DE RESET DO WI-FI (Apertar botão BOOT por 4 segundos)
  // ============================================================================
  if (digitalRead(PINO_BOTAO_RESET) == LOW) {
    unsigned long tempoPressionado = millis();
    webPrintln("\n⚠️ [SISTEMA] Segure o Botão BOOT por 4s para Formatar a Rede...");
    
    while (digitalRead(PINO_BOTAO_RESET) == LOW) {
      esp_task_wdt_reset(); 
      if (millis() - tempoPressionado >= 4000) {
        webPrintln("\n⚠️ [SISTEMA] FORMATANDO CREDENCIAIS DE REDE...");
        WiFiManager wm;
        wm.resetSettings(); 
        webPrintln("✅ Memória apagada. Reiniciando a placa em 2s...");
        delay(2000);
        ESP.restart(); 
      }
      delay(10);
    }
  }

  // ============================================================================
  // ROTINA DE TELEMETRIA E CONTROLE FÍSICO (A CADA 10 SEGUNDOS)
  // ============================================================================
  if (now - lastMsgTime >= INTERVALO_TELEMETRIA_MS) {
    lastMsgTime = now; 

    float tSuavizada = lerTemperaturaSuavizada();
    float umid = dht.readHumidity();

    // O DHT e auxiliar. Se falhar, a placa continua operando pelo NTC, mas
    // registra a falha para o painel mostrar manutencao preventiva.
    dhtValido = isfinite(umid);
    if (!dhtValido) {
      falhasDHTSeguidas++;
      contadorFalhaDHT++;
      salvarContador("dht_fail", contadorFalhaDHT);
      umid = 0.0f;
    } else {
      falhasDHTSeguidas = 0;
    }

    if (falhasDHTSeguidas >= DHT_MAX_FALHAS_SEGUIDAS) {
      webPrintln("⚠️ [DHT] Sensor com falhas consecutivas; mantendo temperatura do NTC como referência.");
    }

    if (!isfinite(tSuavizada)) {
      // O NTC e o sensor critico de controle. Sem ele, o compressor e desligado
      // imediatamente para evitar operacao cega.
      ntcValido = false;
      contadorFalhaNTC++;
      salvarContador("ntc_fail", contadorFalhaNTC);
      estadoControle = ControleEstado::FALHA_SENSOR;
      desligarReleEmergencia();
      webPrintln("❌ [ALERTA] Falha crítica do NTC. Compressor em estado seguro.");
      return;
    }

    xSemaphoreTake(sysMutex, portMAX_DELAY);
    bool emEmergencia = bloqueioEmergencia;
    float tCritica = TEMP_CRITICA;
    float tAtencao = TEMP_ATENCAO;
    xSemaphoreGive(sysMutex);

    if (!emEmergencia && now - ultimoDegelo >= TEMPO_ENTRE_DEGELOS) {
      // Degelo periodico local independe do backend; continua funcionando mesmo
      // sem Wi-Fi ou MQTT.
      estadoDegelo = true;
      ultimoDegelo = now;
      estadoControle = ControleEstado::DEGELO;
      desligarReleEmergencia();
      webPrintln("❄️ [HW] Iniciando Degelo Autônomo de Segurança.");
    }

    if (estadoControle == ControleEstado::FALHA_SENSOR) {
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, HIGH);
    }
    else if (estadoDegelo) {
      estadoControle = ControleEstado::DEGELO;
      desligarReleEmergencia();
      if (now - ultimoDegelo >= DURACAO_DEGELO) {
        estadoDegelo = false;
        ultimoDegelo = now;
        estadoControle = ControleEstado::NORMAL;
        webPrintln("🔥 [HW] Fim do Degelo. Retomando refrigeração.");
      }
    }
    else if (emEmergencia) {
      estadoControle = ControleEstado::EMERGENCIA;
      desligarReleEmergencia();
    }
    else if (controleManualAtivo) {
      estadoControle = digitalRead(PINO_RELE) ? ControleEstado::REFRIGERANDO : ControleEstado::NORMAL;
    }
    else {
      // Controle automatico com histerese: liga em temperatura critica e desliga
      // somente quando cai abaixo da atencao menos margem.
      if (tSuavizada >= tCritica) {
        estadoControle = ControleEstado::REFRIGERANDO;
        aplicarEstadoRele(true);
      }
      else if (tSuavizada <= tAtencao - 2.0f) {
        estadoControle = ControleEstado::NORMAL;
        aplicarEstadoRele(false);
      }
    }

    if (estadoDegelo) {
      // LEDs sao uma interface fisica simples para manutencao em campo:
      // verde normal, amarelo atencao/degelo, vermelho critico/falha.
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, HIGH); digitalWrite(PINO_VERMELHO, HIGH);
    }
    else if (tSuavizada >= tCritica) {
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, HIGH);
    } else if (tSuavizada >= tAtencao) {
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, HIGH); digitalWrite(PINO_VERMELHO, LOW);
    } else {
      digitalWrite(PINO_VERDE, HIGH); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, LOW);
    }

    bool statusMotor = digitalRead(PINO_RELE);

    time_t currentEpoch = 0;
    time(&currentEpoch);

    struct tm timeinfo;
    String horaAtual = "Aguardando NTP...";
    if (getLocalTime(&timeinfo, 50)) {
      char timeBuff[64];
      strftime(timeBuff, sizeof(timeBuff), "%d/%m/%Y %H:%M:%S", &timeinfo);
      horaAtual = String(timeBuff);
    }

    int slotSalvo = bufferHead;

    LeituraBuffer novoRegistro;
    novoRegistro.timestamp = currentEpoch;
    novoRegistro.temp = tSuavizada;
    novoRegistro.umid = umid;
    novoRegistro.motor = statusMotor;
    novoRegistro.degelo = estadoDegelo;

    xSemaphoreTake(sysMutex, portMAX_DELAY);
    bool rtcCheio = (bufferCount >= RTC_BUFFER_CAPACIDADE);
    LeituraBuffer registroPerdido;
    if (rtcCheio) registroPerdido = rtc_bufferOffline[bufferTail];
    xSemaphoreGive(sysMutex);

    if (rtcCheio) {
      // Quando a RTC enche, o registro mais antigo vai para LittleFS antes de
      // abrir espaco para a leitura nova.
      arquivarRegistroFlash(registroPerdido);
      xSemaphoreTake(sysMutex, portMAX_DELAY);
      bufferTail = (bufferTail + 1) % RTC_BUFFER_CAPACIDADE;
      bufferCount--;
      xSemaphoreGive(sysMutex);
    }

    xSemaphoreTake(sysMutex, portMAX_DELAY);
    // Toda leitura entra primeiro na fila local. A TaskNetwork publica e remove
    // quando houver MQTT, evitando perda durante quedas momentaneas.
    rtc_bufferOffline[bufferHead] = novoRegistro;
    bufferHead = (bufferHead + 1) % RTC_BUFFER_CAPACIDADE;
    if (bufferCount < RTC_BUFFER_CAPACIDADE) bufferCount++;
    xSemaphoreGive(sysMutex);

    String payloadStr = gerarPayload(tSuavizada, umid, statusMotor, estadoDegelo, "NENHUM", currentEpoch);

    webPrintln();
    webPrintln("==================================================");
    webPrintln(" 📡 [TELEMETRIA] Nova Leitura de Sensores");
    webPrintln("==================================================");
    webPrintln(" 🕒  Data/Hora    : " + horaAtual);
    webPrintln(" 🌡️  Temperatura  : " + String(tSuavizada, 2) + " °C (Calibrada)");
    webPrintln(" 💧  Umidade      : " + String(umid, 1) + " %");
    webPrintln(" ⚙️  Atuador (M)  : " + String(statusMotor ? "LIGADO (Refrigerando)" : "DESLIGADO"));
    webPrintln(" 📶  Sinal Wi-Fi  : " + String(WiFi.RSSI()) + " dBm");

    if (estadoDegelo || emEmergencia) {
      webPrintln("--------------------------------------------------");
      if (estadoDegelo) webPrintln(" ❄️  [STATUS] Ciclo de Degelo Ativo");
      if (emEmergencia) webPrintln(" 🚨  [ALERME] Motor Travado pela I.A. NOC");
    }

    webPrintln("==================================================");
    webPrintln(" 📦 [PAYLOAD] : " + payloadStr);

    if (!client.connected()) {
      webPrintln(" 💾 [OFFLINE] Sem conexão. Gravado na RAM RTC (Slot " + String(slotSalvo) + ")");
    }
  }

  vTaskDelay(pdMS_TO_TICKS(50));
}
