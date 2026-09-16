require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Concentra a logica de testar email para manter o restante do modulo mais legivel.
 */
async function testarEmail() {
    console.log("⏳ A tentar conectar ao servidor do Google...");
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error("Configure SMTP_USER e SMTP_PASS no ambiente antes de testar o envio.");
        process.exitCode = 1;
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' }
    });

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || `"Teste TermoSync" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_TEST_TO || process.env.SMTP_USER,
            subject: "Teste de SMTP - Sucesso!",
            text: "Se você recebeu isto, o Google autorizou o envio!"
        });
        console.log("✅ SUCESSO ABSOLUTO! O e-mail foi enviado.");
    } catch (error) {
        console.error("❌ FALHA NO ENVIO. O Google ou a sua rede bloqueou:");
        console.error(error.message);
    }
}

testarEmail();
