const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('[WHATSAPP] A inicializar o motor do navegador...');

const client = new Client({
    // Guarda a sessão na pasta .wwebjs_auth para não pedir QR Code sempre
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }), 
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('\n=========================================');
    console.log('📱 LEIA O QR CODE COM O SEU WHATSAPP');
    console.log('=========================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    console.log('\n✅ [WHATSAPP] Bot TermoSync conectado e pronto!');
});

client.on('authenticated', () => {
    console.log('🔐 [WHATSAPP] Sessão restaurada com sucesso!');
});

client.on('disconnected', (reason) => {
    console.log('❌ [WHATSAPP] Bot desconectado:', reason);
    isReady = false;
});

try {
    client.initialize();
} catch (error) {
    console.error('❌ [WHATSAPP] Erro fatal ao iniciar:', error);
}

const enviarAlertaWhatsApp = async (mensagem, loja = 'SISTEMA CENTRAL') => {
    if (!isReady) return;
    
    const numeroDestino = process.env.WHATSAPP_DESTINO;
    if (!numeroDestino) {
        console.log('⚠️ [WHATSAPP] Destino não configurado no .env');
        return;
    }

    try {
        const numeroLimpo = String(numeroDestino).replace(/\D/g, '');
        const chatId = `${numeroLimpo}@c.us`; 
        
        const mensagemFormatada = `🚨 *TERMOSYNC - ${loja.toUpperCase()}* 🚨\n\n${mensagem}\n\n⚙️ _Acesse ao painel para intervir._`;
        
        await client.sendMessage(chatId, mensagemFormatada);
        console.log(`📲 [WHATSAPP] Alerta da loja "${loja}" enviado com sucesso!`);
    } catch (error) {
        console.error('❌ [WHATSAPP] Erro ao enviar mensagem:', error.message);
    }
};

module.exports = { enviarAlertaWhatsApp };