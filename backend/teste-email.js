const nodemailer = require('nodemailer');

async function testarEmail() {
    console.log("⏳ A tentar conectar ao servidor do Google...");

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, 
        auth: {
            // COLOQUE AS SUAS CREDENCIAIS REAIS AQUI DENTRO DAS ASPAS:
            user: 'thermosync126@gmail.com', 
            pass: 'uhpm iasu atae tnbt' 
        },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: '"Teste TermoSync" <thermosync126@gmail.com>',
            to: 'thermosync126@gmail.com', // Envie para si mesmo para testar
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