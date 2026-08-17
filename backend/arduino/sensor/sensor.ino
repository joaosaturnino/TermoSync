#include <WiFi.h>
#include <PubSubClient.h>
#include <math.h>
#include <DHT.h>

// ==============================================================================
// 1. CONFIGURAÇÕES DA REDE E BROKER MQTT
// ==============================================================================
const char* ssid = "Henrique";           // Nome da rede Wi-Fi
const char* password = "lopes123";       // Senha do Wi-Fi

const char* mqtt_server = "192.168.200.27"; // IP do computador onde o Node.js (Aedes) está rodando
const int mqtt_port = 1883;                 // Porta padrão do MQTT
const char* mqtt_topic = "termosync/telemetria"; // Tópico onde o ESP32 vai ENVIAR os dados

// Variável global que vai guardar o tópico de escuta. Ela está vazia agora
// porque será montada dinamicamente lá no setup(), baseada no EQUIPAMENTO_ID.
String topico_comandos = ""; 

WiFiClient espClient;           // Cria o cliente de rede do ESP32
PubSubClient client(espClient); // Passa a rede para o cliente MQTT

// ==============================================================================
// 2. CONFIGURAÇÕES DO EQUIPAMENTO E ATUADORES
// ==============================================================================
const int EQUIPAMENTO_ID = 1; // ID exclusivo desta máquina no banco de dados (MySQL)
const int PINO_RELE = 2;      // Pino onde o Relé do Compressor (ou o Cooler de teste) está ligado

// Pinos do Semáforo (LEDs)
const int PINO_VERDE = 25;    // Tudo OK
const int PINO_AMARELO = 26;  // Atenção (esquentando)
const int PINO_VERMELHO = 27; // Crítico (passou do limite)

// Variáveis de limite de temperatura.
// ATENÇÃO: Elas NÃO são 'const' (constantes) porque o Servidor Node.js 
// pode enviar um comando via MQTT alterando esses valores em tempo real.
float TEMP_ATENCAO = 26.0; 
float TEMP_CRITICA = 30.0; 

// ==============================================================================
// 3. CONFIGURAÇÕES DE SENSORES
// ==============================================================================
// Dados técnicos do Sensor de Temperatura NTC 10K
const int PINO_NTC = 34;                    // Pino analógico (seguro para usar com Wi-Fi)
const float RESISTOR_SERIE = 9740.0;        // Valor real do resistor na sua placa (aprox. 10k)
const float RESISTENCIA_NOMINAL = 10000.0;  // 10kΩ a 25°C (padrão de fábrica do sensor)
const float TEMPERATURA_NOMINAL = 25.0;     // Temperatura de referência (em °C)
const float COEFICIENTE_BETA = 3435.0;      // Curva térmica do sensor NTC

// Dados do Sensor de Umidade DHT11
#define DHTPIN 4                            // Pino de dados do DHT11
#define DHTTYPE DHT11                       // Modelo do sensor
DHT dht(DHTPIN, DHTTYPE);                   // Inicia a biblioteca do DHT

// ==============================================================================
// 4. CONTROLE DE TEMPO (ASSÍNCRONO)
// ==============================================================================
unsigned long startTime = 0;            // Marca quando a placa foi ligada
unsigned long lastMsgTime = 0;          // Marca a última vez que enviou dados (10 em 10s)
unsigned long lastReconnectAttempt = 0; // Marca a última tentativa de reconexão MQTT
unsigned long lastWifiAttempt = 0;      // Marca a última tentativa de reconectar o Wi-Fi

// ==============================================================================
// 5. FUNÇÃO CALLBACK (Ouvido do ESP32)
// ==============================================================================
void callback(char* topic, byte* payload, unsigned int length) {
  String mensagem = "";
  for (int i = 0; i < length; i++) {
    mensagem += (char)payload[i];
  }
  
  // 5.1: Se a mensagem contiver o comando de CONFIGURAÇÃO
  if (mensagem.indexOf("\"acao\":\"CONFIG\"") > 0) {
    Serial.println("\n📥 [SISTEMA] Sincronizando regras de temperatura via Servidor...");
    
    auto extrairValor = [](String json, String chave) -> float {
        int startIdx = json.indexOf("\"" + chave + "\":");
        if (startIdx == -1) return NAN;
        startIdx += chave.length() + 3;
        int endIdx = json.indexOf(",", startIdx);
        if (endIdx == -1) endIdx = json.indexOf("}", startIdx);
        return json.substring(startIdx, endIdx).toFloat();
    };

    float novaCritica = extrairValor(mensagem, "temp_critica");
    float novaAtencao = extrairValor(mensagem, "temp_atencao");

    if (!isnan(novaCritica)) TEMP_CRITICA = novaCritica;
    if (!isnan(novaAtencao)) TEMP_ATENCAO = novaAtencao;

    Serial.println("✅ Limites do Semáforo Atualizados!");
    Serial.print("   -> Ligar Amarelo em: "); Serial.print(TEMP_ATENCAO); Serial.println(" °C");
    Serial.print("   -> Ligar Vermelho em: "); Serial.print(TEMP_CRITICA); Serial.println(" °C");
    return; 
  }

  // 5.2 e 5.3: Comandos Manuais do Painel (Logs Originais Mantidos)
  Serial.println("\n==============================================");
  Serial.println("⚡ [MQTT] COMANDO RECEBIDO DO PAINEL!");
  Serial.println("Payload: " + mensagem);

  if (mensagem.indexOf("\"acao\":\"REBOOT\"") > 0) {
    Serial.println("-> AÇÃO: Reiniciando o ESP32 (SIGTERM) em 3s...");
    delay(3000);
    ESP.restart(); 
  }
  else if (mensagem.indexOf("\"acao\":\"OTA\"") > 0) {
    digitalWrite(PINO_RELE, !digitalRead(PINO_RELE)); 
    Serial.println("-> AÇÃO: Alterando estado do Relé/Motor!");
  }
  
  Serial.println("==============================================\n");
}

// ==============================================================================
// 6. FUNÇÕES DE CONEXÃO (À PROVA DE TRAVAMENTOS)
// ==============================================================================
void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.println();
  Serial.print("[WIFI] Conectando a: "); 
  Serial.println(ssid);
  
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(ssid, password);
  
  unsigned long inicio = millis();
  
  // Fica no loop no máximo 10s para não travar o controle da geladeira
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 10000) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WIFI] Conectado com sucesso!");
    Serial.print("[WIFI] IP Local: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WIFI] MAC: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println();
    Serial.println("[WIFI] Timeout ao conectar. Trabalhando offline temporariamente.");
  }
}

boolean reconnectMQTT() {
  Serial.print("[MQTT] Tentando conectar ao Broker...");
  
  String clientId = "TermoSyncEdge-";
  uint64_t chipid = ESP.getEfuseMac();
  clientId += String((uint32_t)(chipid >> 32), HEX);
  clientId += String((uint32_t)chipid, HEX);

  Serial.print(" ClientID: ");
  Serial.println(clientId);

  if (client.connect(clientId.c_str())) {
    Serial.println("[MQTT] Conectado com sucesso!");
    
    // Assina o Tópico de Comandos
    client.subscribe(topico_comandos.c_str());
    Serial.println("[MQTT] Aguardando comandos do painel no topico: " + String(topico_comandos));
    
    // Pede as configurações da API
    String topicoPedido = "termosync/hardware/" + String(EQUIPAMENTO_ID) + "/pedir_config";
    client.publish(topicoPedido.c_str(), "{}");
    Serial.println("[MQTT] Solicitando configurações de temperatura ao Servidor...");
    
    return true;
  }
  
  Serial.print("[MQTT] Falha. Código: ");
  Serial.println(client.state());
  Serial.println("[MQTT] Nova tentativa em 5 segundos...");
  return false;
}

// ==============================================================================
// 7. FUNÇÃO DE LEITURA DO SENSOR DE TEMPERATURA
// ==============================================================================
float lerTemperaturaNTC() {
  const int NUM_AMOSTRAS = 20;
  long somaADC = 0;

  for (int i = 0; i < NUM_AMOSTRAS; i++) {
    somaADC += analogRead(PINO_NTC);
    delay(5);
  }

  float leituraADC = somaADC / (float)NUM_AMOSTRAS;

  Serial.print("[NTC] ADC médio: ");
  Serial.println(leituraADC);

  if (leituraADC <= 0 || leituraADC >= 4095) {
    Serial.println("[NTC] ERRO: leitura ADC fora da faixa. Verifique a ligação do sensor.");
    return NAN;
  }

  float resistenciaNTC = RESISTOR_SERIE * ((4095.0 / leituraADC) - 1.0);

  Serial.print("[NTC] Resistencia: ");
  Serial.print(resistenciaNTC);
  Serial.println(" ohms");

  if (resistenciaNTC <= 0 || !isfinite(resistenciaNTC)) {
    Serial.println("[NTC] ERRO: resistência inválida.");
    return NAN;
  }

  float temperaturaKelvin = 1.0 / ((1.0 / (TEMPERATURA_NOMINAL + 273.15)) + (log(resistenciaNTC / RESISTENCIA_NOMINAL) / COEFICIENTE_BETA));
  float temperaturaCelsius = temperaturaKelvin - 273.15;

  if (!isfinite(temperaturaCelsius)) {
    Serial.println("[NTC] ERRO: temperatura inválida.");
    return NAN;
  }

  Serial.print("[NTC] Temperatura calculada: ");
  Serial.print(temperaturaCelsius, 2);
  Serial.println(" °C");

  return temperaturaCelsius;
}

// ==============================================================================
// 8. SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("       TermoSync Edge - ESP32 (Plug & Play)");
  Serial.println("==============================================");

  // Monta o tópico de comandos dinamicamente com base no ID da placa
  topico_comandos = "termosync/comandos/" + String(EQUIPAMENTO_ID);

  // Configura os Pinos
  pinMode(PINO_RELE, OUTPUT);
  digitalWrite(PINO_RELE, LOW); 

  pinMode(PINO_VERDE, OUTPUT);
  pinMode(PINO_AMARELO, OUTPUT);
  pinMode(PINO_VERMELHO, OUTPUT);

  digitalWrite(PINO_VERDE, LOW);
  digitalWrite(PINO_AMARELO, LOW);
  digitalWrite(PINO_VERMELHO, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(PINO_NTC, ADC_11db); 

  dht.begin();
  Serial.println("[DHT] DHT11 inicializado.");

  startTime = millis(); 
  conectarWiFi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback); 
  client.setBufferSize(512);

  Serial.println("[SISTEMA] Inicialização concluída.");
}

// ==============================================================================
// 9. LOOP PRINCIPAL
// ==============================================================================
void loop() {
  unsigned long now = millis(); 

  // ============================================================================
  // GESTÃO DE CONEXÃO INTELIGENTE (SEM TRAVAR O TERMOSTATO)
  // ============================================================================
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttempt > 15000) {
      lastWifiAttempt = now;
      conectarWiFi();
    }
  } 
  else if (!client.connected()) {
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      reconnectMQTT();
    }
  } 
  else {
    client.loop();
  }

  // ============================================================================
  // ROTINA DE TELEMETRIA E CONTROLE FÍSICO (A cada 10 segundos)
  // ============================================================================
  if (now - lastMsgTime >= 10000) {
    lastMsgTime = now; 

    Serial.println();
    Serial.println("==============================================");
    Serial.println("[TELEMETRIA] Nova leitura");
    Serial.println("==============================================");

    float temperaturaCelsius = lerTemperaturaNTC();
    float umidadeRelativa = dht.readHumidity();

    if (isnan(umidadeRelativa)) {
      Serial.println("[DHT] Falha na leitura da umidade.");
      umidadeRelativa = 50.0;
    }

    unsigned long upMs = now - startTime;
    unsigned long horas = upMs / 3600000;
    unsigned long minutos = (upMs % 3600000) / 60000;
    String uptimeStr = String(horas) + "h " + String(minutos) + "m";

    if (isnan(temperaturaCelsius)) {
      Serial.println("[TELEMETRIA] Temperatura inválida. Pacote não será enviado.");
      return; 
    }

    // ========================================================================
    // TERMOSTATO AUTÔNOMO (Controle Físico do Compressor)
    // ========================================================================
    if (temperaturaCelsius >= TEMP_CRITICA) {
      digitalWrite(PINO_RELE, HIGH); 
    } 
    else if (temperaturaCelsius <= TEMP_ATENCAO - 2.0) {
      digitalWrite(PINO_RELE, LOW); 
    }

    // ========================================================================
    // ATUALIZAÇÃO DO SEMÁFORO (Muda a cor do LED da caixinha física)
    // ========================================================================
    if (temperaturaCelsius >= TEMP_CRITICA) {
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, HIGH);
    } else if (temperaturaCelsius >= TEMP_ATENCAO) {
      digitalWrite(PINO_VERDE, LOW); digitalWrite(PINO_AMARELO, HIGH); digitalWrite(PINO_VERMELHO, LOW);
    } else {
      digitalWrite(PINO_VERDE, HIGH); digitalWrite(PINO_AMARELO, LOW); digitalWrite(PINO_VERMELHO, LOW);
    }

    bool statusMotor = digitalRead(PINO_RELE);

    // ========================================================================
    // MONTAGEM SEGURA DO PACOTE JSON
    // ========================================================================
    String payload = "";
    payload.reserve(300); 
    
    payload += "{";
    payload += "\"equipamento_id\":";
    payload += String(EQUIPAMENTO_ID);
    payload += ",";
    payload += "\"temperatura\":";
    payload += String(temperaturaCelsius, 2);
    payload += ",";
    payload += "\"umidade\":";
    payload += String(umidadeRelativa, 1);
    payload += ",";
    payload += "\"consumo_kwh\":0.0,";
    payload += "\"motor_ligado\":" + String(statusMotor ? "true" : "false") + ",";
    payload += "\"em_degelo\":false,";
    payload += "\"alerta_forcado\":\"NENHUM\",";
    payload += "\"mac_address\":\"";
    payload += WiFi.macAddress();
    payload += "\",";
    payload += "\"ip_local\":\"";
    payload += WiFi.localIP().toString();
    payload += "\",";
    payload += "\"sinal_wifi\":";
    payload += String(WiFi.RSSI());
    payload += ",";
    payload += "\"uptime\":\"";
    payload += uptimeStr;
    payload += "\",";
    payload += "\"firmware_version\":\"v6.0-Industrial\""; 
    payload += "}";

    // ========================================================================
    // Exibe informações no Serial (Idêntico ao original)
    // ========================================================================
    Serial.println();
    Serial.print("[SENSOR] Temperatura: ");
    Serial.print(temperaturaCelsius, 2);
    Serial.println(" °C");

    Serial.print("[SENSOR] Umidade: ");
    Serial.print(umidadeRelativa, 1);
    Serial.println(" %");

    Serial.print("[WIFI] RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    Serial.print("[MQTT] Payload: ");
    Serial.println(payload);

    // ========================================================================
    // ENVIO DA TELEMETRIA
    // ========================================================================
    if (client.connected()) {
      if (client.publish(mqtt_topic, payload.c_str())) {
        Serial.println("[MQTT] Dados enviados com sucesso!");
      } else {
        Serial.println("[MQTT] ERRO ao publicar os dados.");
      }
    } else {
      Serial.println("[AVISO] Trabalhando offline. Termostato local cuidando da máquina.");
    }
  }
}