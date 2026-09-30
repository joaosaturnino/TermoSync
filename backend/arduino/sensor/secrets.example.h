#pragma once

// Copie este arquivo para secrets.h e use credenciais exclusivas por dispositivo.
// secrets.h e ignorado pelo Git e nunca deve ser enviado ao repositorio.
#define TERMOSYNC_MQTT_USER "dispositivo_001"
#define TERMOSYNC_MQTT_PASS "substitua-por-uma-senha-longa-e-unica"
#define TERMOSYNC_PORTAL_PASSWORD "substitua-por-uma-senha-longa-e-unica"
#define TERMOSYNC_OTA_PASSWORD "substitua-por-uma-senha-longa-e-unica"
#define TERMOSYNC_WEB_USER "tecnico"
#define TERMOSYNC_WEB_PASSWORD "substitua-por-uma-senha-longa-e-unica"
#define TERMOSYNC_WEB_CORS_ORIGIN "http://192.168.1.10:5173"

// Mantenha 0 na bancada. Use 1 somente depois de instalar driver isolado,
// contator dimensionado, realimentacao e intertravamentos independentes.
#define TERMOSYNC_PHYSICAL_ACTUATOR 0

// Produção: use 1, porta 8883 e cole o certificado CA em formato PEM.
#define TERMOSYNC_USE_TLS 0
#define TERMOSYNC_MQTT_PORT 1883
#define TERMOSYNC_MQTT_CA_CERT ""
#define TERMOSYNC_REQUIRE_FRESH_COMMANDS 1
