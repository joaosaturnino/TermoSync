/** Centraliza as responsabilidades do módulo operational Defaults. */

const checklistTurno = [
  ['pre-turno', 'Verificar temperatura das câmaras frias e balcões'],
  ['pre-turno', 'Inspecionar painel elétrico e disjuntores gerais'],
  ['pre-turno', 'Validar conexão de rede do Gateway Edge (Wi-Fi/LAN)'],
  ['pre-turno', 'Checar integridade dos selos das portas das câmaras'],
  ['pre-turno', 'Verificar funcionamento dos compressores principais'],
  ['pre-turno', 'Inspecionar possíveis vazamentos de fluidos refrigerantes'],
  ['pre-turno', 'Conferir iluminação interna e externa dos equipamentos'],
  ['operacao', 'Monitorar alarmes críticos no painel NOC'],
  ['operacao', 'Validar ciclo de degelo da ilha de congelados'],
  ['operacao', 'Checar fechamento hermético das portas após abastecimento'],
  ['operacao', 'Monitorar consumo de energia fora do padrão'],
  ['operacao', 'Verificar ruídos anormais nos motores e exaustores'],
  ['operacao', 'Confirmar estabilidade do sinal dos sensores IoT'],
  ['operacao', 'Registrar variações térmicas durante o horário de pico'],
  ['operacao', 'Inspecionar acúmulo de gelo nos evaporadores'],
  ['encerramento', 'Exportar relatório diário de eficiência e conformidade'],
  ['encerramento', 'Garantir rotina de backup diário'],
  ['encerramento', 'Ativar setpoints de economia noturna'],
  ['encerramento', 'Desligar iluminação e equipamentos não essenciais'],
  ['encerramento', 'Verificar fechamento das cortinas noturnas'],
  ['encerramento', 'Confirmar que não há alarmes críticos sem tratativa']
].map(([chave, titulo], ordem) => ({ chave, titulo, ordem }));

const planoDia = [
  ['08:00', 'Validar presenças e faltas da equipe do turno'],
  ['08:30', 'Revisar anomalias pendentes de ontem no NOC'],
  ['09:00', 'Inspecionar balcões da frente de loja'],
  ['10:00', 'Verificar SLAs de chamados técnicos abertos'],
  ['12:00', 'Validar ciclo térmico na ilha de congelados'],
  ['14:00', 'Auditar mercadorias no corredor de laticínios'],
  ['15:30', 'Revisar consumo parcial de energia'],
  ['16:00', 'Acompanhar recebimento e armazenagem na câmara fria'],
  ['17:30', 'Sincronizar relatório com a Manutenção Central'],
  ['18:00', 'Alinhar o turno com encarregados de setor'],
  ['19:30', 'Inspecionar cortinas de ar para o turno da noite'],
  ['21:00', 'Conferir painel de alarmes e temperaturas'],
  ['21:45', 'Consolidar relatório diário da operação'],
  ['22:00', 'Ativar parâmetros de encerramento dos equipamentos']
].map(([horario, titulo], ordem) => ({ chave: `meta-${ordem + 1}`, titulo, horario, ordem }));

const procedimentos = [
  {
    chave: 'temperatura', titulo: 'Temperatura fora da faixa', categoria: 'Emergência', severidade: 'Crítica',
    responsavel: 'Operação + Manutenção', sla: 'Iniciar em até 5 min', icone: 'thermometer', tiposAlerta: ['TEMPERATURA'], rota: 'motores',
    gatilho: 'Leitura acima ou abaixo dos limites configurados, sem ciclo de degelo justificando o desvio.',
    objetivo: 'Conter a exposição térmica e identificar se a causa é operacional, elétrica ou mecânica.',
    etapas: ['Confirme a leitura no painel e compare com o setpoint do equipamento.', 'Faça inspeção visual sem manter a porta aberta e confirme vedação, carga e circulação de ar.', 'Verifique motor, degelo e horário da última comunicação.', 'Registre horário, temperatura encontrada e evidências no chamado.', 'Acione manutenção se a tendência não retornar à faixa ou continuar subindo.'],
    evidencias: ['Temperatura inicial e final', 'Foto da vedação ou evaporador', 'Horário da inspeção', 'Responsável pelo atendimento'],
    escalonamento: 'Escalone imediatamente quando houver produto sensível, aumento contínuo ou mais de um equipamento afetado.'
  },
  {
    chave: 'mecanica', titulo: 'Compressor ou motor parado', categoria: 'Emergência', severidade: 'Crítica',
    responsavel: 'Manutenção', sla: 'Iniciar em até 5 min', icone: 'power', tiposAlerta: ['MECANICA'], rota: 'chamados',
    gatilho: 'Motor desligado fora do degelo, ruído anormal, proteção atuada ou ausência de refrigeração.',
    objetivo: 'Preservar o equipamento e reduzir o tempo sem refrigeração.',
    etapas: ['Confirme que o equipamento não está em degelo programado.', 'Inspecione alimentação, disjuntor e sinais de aquecimento sem rearmar repetidamente.', 'Verifique ruído, vibração e condição dos ventiladores.', 'Isole a área se houver odor, fumaça ou risco elétrico.', 'Abra uma OS crítica com todas as evidências e transfira produtos quando necessário.'],
    evidencias: ['Estado elétrico encontrado', 'Ruído ou vibração observada', 'Temperatura do compartimento', 'Ação de contingência'],
    escalonamento: 'Não force rearme após nova atuação da proteção. Escalone para técnico habilitado.'
  },
  {
    chave: 'porta', titulo: 'Porta aberta ou vedação comprometida', categoria: 'Operação', severidade: 'Alta',
    responsavel: 'Operação', sla: 'Iniciar em até 10 min', icone: 'door-open', tiposAlerta: ['PORTA', 'PORTA_ABERTA'], rota: 'dashboard',
    gatilho: 'Alerta de porta, condensação, entrada de ar ou recuperação térmica lenta.', objetivo: 'Restabelecer o isolamento e impedir recorrência do desvio.',
    etapas: ['Feche a porta e remova qualquer obstrução.', 'Inspecione borracha, dobradiça, trinco e alinhamento.', 'Confirme no painel se o alerta foi encerrado.', 'Acompanhe a temperatura por pelo menos um ciclo de atualização.', 'Abra chamado quando houver dano ou reincidência.'],
    evidencias: ['Condição da vedação', 'Tempo estimado de abertura', 'Temperatura após fechamento'], escalonamento: 'Transfira os produtos quando a porta não puder ser mantida fechada.'
  },
  {
    chave: 'rede', titulo: 'Perda de comunicação IoT', categoria: 'IoT', severidade: 'Alta', responsavel: 'Operação + TI',
    sla: 'Iniciar em até 15 min', icone: 'wifi-off', tiposAlerta: ['REDE'], rota: 'hardware', gatilho: 'Heartbeat atrasado, sensor offline ou interrupção recorrente da telemetria.',
    objetivo: 'Distinguir falha de comunicação de falha real do equipamento.',
    etapas: ['Confirme fisicamente se o equipamento continua operando.', 'Verifique energia do controlador, sinal Wi-Fi e conectividade local.', 'Compare o horário do último heartbeat com outros dispositivos da filial.', 'Não reinicie em massa; teste apenas o nó afetado.', 'Registre o período sem dados e escale para TI se a conexão não retornar.'],
    evidencias: ['Último heartbeat', 'IP e intensidade de sinal', 'Estado físico do equipamento', 'Resultado do teste local'], escalonamento: 'Trate como risco térmico até que uma leitura física confirme a condição do equipamento.'
  },
  {
    chave: 'umidade', titulo: 'Umidade fora do padrão', categoria: 'Qualidade', severidade: 'Média', responsavel: 'Operação + Qualidade',
    sla: 'Avaliar em até 20 min', icone: 'droplets', tiposAlerta: ['UMIDADE'], rota: 'umidade', gatilho: 'Leitura higrométrica persistente fora dos limites do setor.',
    objetivo: 'Confirmar a leitura e corrigir causas ambientais ou operacionais.',
    etapas: ['Aguarde uma segunda leitura para descartar oscilação instantânea.', 'Confirme portas, circulação de ar e presença de fontes de umidade.', 'Compare com outro sensor ou instrumento de referência disponível.', 'Registre o contexto operacional no momento do desvio.', 'Acione manutenção ou qualidade se a condição persistir.'],
    evidencias: ['Duas leituras consecutivas', 'Condição de portas e carga', 'Comparação com referência'], escalonamento: 'Escalone quando houver condensação, risco ao produto ou divergência entre instrumentos.'
  },
  {
    chave: 'degelo', titulo: 'Degelo prolongado', categoria: 'Operação', severidade: 'Média', responsavel: 'Operação + Manutenção',
    sla: 'Acompanhar o ciclo', icone: 'snowflake', tiposAlerta: ['DEGELO'], rota: 'motores', gatilho: 'Ciclo acima do tempo esperado ou temperatura sem recuperação após o término.',
    objetivo: 'Validar o ciclo e detectar falha de retorno à refrigeração.',
    etapas: ['Confirme início e duração prevista do ciclo.', 'Evite abertura de portas e movimentação desnecessária da carga.', 'Acompanhe o estado do motor e a curva de temperatura.', 'Confirme o retorno ao setpoint após o término.', 'Abra chamado se o motor não retornar ou a temperatura continuar elevada.'],
    evidencias: ['Início e fim do ciclo', 'Maior temperatura observada', 'Tempo de recuperação'], escalonamento: 'Escalone quando o ciclo exceder o padrão do equipamento ou houver repetição.'
  },
  {
    chave: 'energia', titulo: 'Falha elétrica ou interrupção de energia', categoria: 'Emergência', severidade: 'Crítica', responsavel: 'Manutenção + Liderança',
    sla: 'Resposta imediata', icone: 'flame', tiposAlerta: ['ENERGIA'], rota: 'energia', gatilho: 'Queda simultânea de equipamentos, proteção elétrica atuada, odor ou aquecimento anormal.',
    objetivo: 'Proteger pessoas, equipamentos e produtos antes de restabelecer a operação.',
    etapas: ['Não toque em componentes com sinais de aquecimento, arco ou fumaça.', 'Confirme o alcance da interrupção e acione a liderança local.', 'Isole a área e chame profissional habilitado quando houver risco.', 'Inicie o plano de contingência e controle o tempo sem refrigeração.', 'Registre equipamentos afetados e horário de normalização.'],
    evidencias: ['Horário da interrupção', 'Circuitos e ativos afetados', 'Ações de contingência', 'Liberação técnica'], escalonamento: 'Risco elétrico exige isolamento imediato. Não improvise ligações ou proteções.'
  },
  {
    chave: 'metrologia', titulo: 'Divergência ou sensor descalibrado', categoria: 'Qualidade', severidade: 'Alta', responsavel: 'Qualidade + Manutenção',
    sla: 'Segregar em até 30 min', icone: 'gauge', tiposAlerta: ['METROLOGIA'], rota: 'metrologia', gatilho: 'Diferença relevante entre sensor, instrumento de referência ou comportamento esperado.',
    objetivo: 'Evitar decisões baseadas em leitura não confiável e preservar rastreabilidade.',
    etapas: ['Compare a leitura com instrumento de referência válido.', 'Identifique sensor, número de série e última calibração.', 'Sinalize a leitura como suspeita e mantenha medição alternativa.', 'Registre valores, horários e instrumento utilizado na comparação.', 'Solicite ajuste, substituição ou calibração conforme o resultado.'],
    evidencias: ['Leitura do sensor e referência', 'Identificação dos instrumentos', 'Certificado ou data de calibração'], escalonamento: 'Não encerre alertas térmicos usando apenas um sensor sob suspeita.'
  }
];

module.exports = { checklistTurno, planoDia, procedimentos };
