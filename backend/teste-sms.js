require('dotenv').config({ path: require('path').join(__dirname, '.env') });

/**
 * Verifica a condicao is env flag enabled e retorna um valor booleano.
 */
const isEnvFlagEnabled = (value) => ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

/**
 * Envia enviar teste sms para o canal ou provedor configurado.
 */
async function enviarTesteSms() {
  const destino = process.env.SMS_TEST_TO || process.argv[2];
  if (!destino) {
    console.error('Informe o telefone em SMS_TEST_TO ou como argumento. Ex: node backend/teste-sms.js +5511999999999');
    process.exit(1);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !messagingService)) {
    if (process.env.TEXTBEE_API_KEY) {
      const payload = {
        recipients: [destino],
        message: '[TermoSync] Mensagem de teste do canal SMS. Seu dispositivo esta apto para enviar codigos de recuperacao.'
      };
      if (process.env.TEXTBEE_DEVICE_ID) payload.deviceId = process.env.TEXTBEE_DEVICE_ID;
      if (process.env.TEXTBEE_SIM_SUBSCRIPTION_ID) payload.simSubscriptionId = Number(process.env.TEXTBEE_SIM_SUBSCRIPTION_ID);

      const response = await fetch(process.env.TEXTBEE_URL || 'https://api.textbee.dev/api/v1/gateway/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.TEXTBEE_API_KEY
        },
        body: JSON.stringify(payload)
      });
      const body = await response.text();
      if (!response.ok) {
        console.error(`Falha textbee ${response.status}: ${body}`);
        process.exit(1);
      }
      console.log(`SMS textbee solicitado para ${destino}: ${body}`);
      return;
    }

    if (isEnvFlagEnabled(process.env.TEXTBELT_ENABLED) || process.env.TEXTBELT_API_KEY) {
      const params = new URLSearchParams();
      params.set('phone', destino);
      params.set('message', '[TermoSync] Mensagem de teste do canal SMS. Seu dispositivo esta apto para enviar codigos de recuperacao.');
      params.set('key', process.env.TEXTBELT_API_KEY || 'textbelt');
      if (process.env.TEXTBELT_SENDER) params.set('sender', process.env.TEXTBELT_SENDER);

      const response = await fetch(process.env.TEXTBELT_URL || 'https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const body = await response.text();
      if (!response.ok) {
        console.error(`Falha Textbelt ${response.status}: ${body}`);
        process.exit(1);
      }
      console.log(`SMS Textbelt enviado para ${destino}: ${body}`);
      return;
    }

    console.error('Configure Twilio ou habilite TEXTBELT_ENABLED=true para teste.');
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.set('To', destino);
  params.set('Body', '[TermoSync] Mensagem de teste do canal SMS. Seu dispositivo esta apto para enviar codigos de recuperacao.');
  if (messagingService) params.set('MessagingServiceSid', messagingService);
  else params.set('From', from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Falha Twilio ${response.status}: ${body}`);
    process.exit(1);
  }

  console.log(`SMS enviado para ${destino}: ${body}`);
}

enviarTesteSms().catch((error) => {
  console.error('Falha ao enviar SMS:', error.message);
  process.exit(1);
});
