# Sonda de rede com Raspberry Pi

O agente do TermoSync transforma um Raspberry Pi conectado à rede da loja em uma sonda remota. Ele detecta automaticamente a rota padrão, a interface Ethernet ou Wi-Fi, a faixa CIDR e o gateway do próprio Raspberry. A faixa detectada é usada nos jobs em modo `AUTO`.

## Comportamento

- Envia heartbeat com IP, gateway, CIDR, interfaces, arquitetura e versão.
- Consulta jobs da filial sem utilizar login ou JWT de usuário.
- Varre a rede privada conectada com concorrência limitada.
- Inclui os IPs dos ESP cadastrados para a filial, mesmo fora do primeiro bloco percorrido.
- Consulta `/health` em hosts HTTP para reconhecer ESP compatíveis.
- Vincula cada conexão ao adaptador diretamente conectado à sub-rede do alvo.
- Entrega portas, latência, origem, identidade IoT e estado ao backend.

## Requisitos

- Raspberry Pi OS ou outra distribuição Linux com o comando `ip`.
- Node.js 18 ou mais recente.
- Acesso HTTPS ou HTTP confiável até a API TermoSync.
- Usuário de serviço `termosync` com leitura do diretório `/opt/termosync`.

## Configuração do servidor

Gere um token longo e diferente dos tokens de login, MQTT e ingestão IoT. Configure-o no `.env` do backend:

```env
NETWORK_PROBE_AGENT_TOKEN=um-token-aleatorio-com-pelo-menos-32-bytes
```

Reinicie o backend para aplicar a variável e executar as migrações das tabelas de agentes e resultados.

## Configuração do Raspberry

1. Instale o projeto em `/opt/termosync`.
2. Crie `/etc/termosync/network-probe.env` a partir de `backend/agents/network-probe.env.example`.
3. Use no Raspberry o mesmo token configurado no servidor.
4. Defina `PROBE_FILIAL` exatamente como a filial cadastrada no TermoSync.
5. Instale `backend/agents/termosync-network-probe.service` em `/etc/systemd/system/`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now termosync-network-probe
sudo systemctl status termosync-network-probe
```

Os logs ficam disponíveis pelo journal:

```bash
journalctl -u termosync-network-probe -f
```

## Teste manual

No diretório `backend`, exporte as variáveis e execute:

```bash
npm run probe:agent
```

O agente aparecerá na aba **Agentes** da tela **Sonda de Rede**. Um heartbeat é considerado online por 90 segundos. Ao enviar uma varredura remota, o primeiro agente online da filial reserva o job de forma atômica.

## Segurança

O token do agente nunca deve ser colocado no frontend ou no firmware ESP. Em produção, exponha a API por HTTPS, restrinja a saída do Raspberry ao host da API e use um token exclusivo por ambiente. A sonda aceita somente IPv4 privado e limita concorrência, portas e quantidade de hosts.
