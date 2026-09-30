/**
 * Ferramenta de documentação de manutenção.
 * Adiciona cabeçalhos aos módulos e JSDoc a funções/rotas ainda não documentadas,
 * sem alterar comentários específicos escritos manualmente.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = ['backend', 'frontend/src', 'frontend/test', 'mobile', 'scripts'];
const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.sql', '.ino']);
const codeExts = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirs = new Set([
  'node_modules',
  '.expo',
  '.git',
  '.wwebjs_auth',
  '.wwebjs_cache',
  'dist',
  'build',
  'coverage',
]);

/**
 * Executa a etapa walk usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: lê ou grava arquivos locais; registra informações de diagnóstico
 *
 * @param {unknown} dir - Valor de dir consumido por esta rotina.
 * @param {unknown} files - Valor de files consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.warn(`Ignorando pasta sem permissao de leitura: ${dir}`);
    return files;
  }

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (exts.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

/**
 * Executa a etapa title from name usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} name - Valor de name consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function titleFromName(name) {
  return name
    .replace(/^use(?=[A-Z])/, 'use ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Retorna o nome do arquivo sem extensao para detectar componentes principais.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function fileBaseName(file) {
  return path.basename(file, path.extname(file));
}

/**
 * Executa a etapa domain from path usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function domainFromPath(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel.includes('/pages/')) return 'tela';
  if (rel.includes('/components/')) return 'componente';
  if (rel.includes('/hooks/')) return 'hook';
  if (rel.includes('/middlewares/')) return 'middleware';
  if (rel.includes('/routes/')) return 'rota/API';
  if (rel.includes('/services/')) return 'servico';
  if (rel.includes('/utils/')) return 'utilitario';
  if (rel.startsWith('mobile/')) return 'aplicativo mobile';
  if (rel.startsWith('scripts/')) return 'script operacional';
  return 'modulo';
}

/**
 * Descreve a responsabilidade principal de cada arquivo pelo seu domínio.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function moduleDescription(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const name = titleFromName(fileBaseName(file));
  const ext = path.extname(file);

  if (rel === 'backend/routes/api.js') return 'Registra os endpoints HTTP, aplica autorização e coordena o acesso aos serviços e ao banco.';
  if (rel === 'frontend/src/App.jsx') return 'Orquestra sessão, dados globais, navegação e composição das telas autenticadas.';
  if (rel === 'mobile/App.js') return 'Orquestra autenticação, navegação e integração do aplicativo móvel com a API.';
  if (ext === '.css') return `Define o layout, os estados visuais e os breakpoints de ${name}.`;
  if (ext === '.sql') return 'Define estruturas e dados persistidos usados pela aplicação.';
  if (ext === '.ino') return 'Controla aquisição de sensores, conectividade e telemetria do dispositivo embarcado.';

  const domain = domainFromPath(file);
  if (domain === 'tela') return `Implementa a tela ${name}, seus estados, interações e integrações de dados.`;
  if (domain === 'componente') return `Implementa o componente reutilizável ${name} e seu contrato visual.`;
  if (domain === 'hook') return `Centraliza estado e efeitos compartilhados pelo hook ${name}.`;
  if (domain === 'middleware') return `Protege requisições e prepara o contexto do middleware ${name}.`;
  if (domain === 'servico') return `Encapsula integrações e regras de serviço de ${name}.`;
  if (domain === 'script operacional') return `Automatiza a rotina operacional ${name}.`;
  if (rel.includes('/test/')) return `Valida automaticamente o comportamento de ${name}.`;
  return `Centraliza as responsabilidades do módulo ${name}.`;
}

/**
 * Verifica se o arquivo já começa com uma descrição de responsabilidade.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {unknown} extension - Valor de extension consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function hasModuleHeader(lines, extension) {
  const firstContent = lines.findIndex((line) => line.trim() !== '');
  if (firstContent < 0) return true;
  const first = lines[firstContent].trim();
  if (extension === '.sql') return first.startsWith('--') || first.startsWith('/*');
  return first.startsWith('/**') || first.startsWith('/*') || first.startsWith('//');
}

/**
 * Cria um cabeçalho compatível com a sintaxe do tipo de arquivo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function moduleHeader(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  return [
    '/**',
    ` * Módulo: ${rel}`,
    ` * Responsabilidade: ${moduleDescription(file)}`,
    ' */',
    '',
  ];
}

/**
 * Executa a etapa describe usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} name - Valor de name consumido por esta rotina.
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @param {unknown} kind - Valor de kind consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function describe(name, file, kind) {
  const label = titleFromName(name || kind || 'funcao');
  const domain = domainFromPath(file);
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lower = label.toLowerCase();
  const isMainPageComponent = domain === 'tela' && name === fileBaseName(file);

  if (kind === 'class') return `Agrupa o comportamento de ${label} para isolar estado, renderizacao e tratamento de erro.`;
  if (rel === 'frontend/src/App.jsx' && name === 'App') return 'Renderiza a aplicação autenticada e coordena sessão, navegação, dados globais e recuperação de falhas.';
  if (isMainPageComponent) return `Renderiza a tela ${label} e concentra as regras de apresentacao desse modulo.`;
  if (domain === 'componente') return `Renderiza o componente ${label} e encapsula sua interacao visual reutilizavel.`;
  if (domain === 'hook') return `Expõe o hook ${label} com estado e acoes compartilhadas pela aplicacao.`;
  if (domain === 'middleware') return `Executa o middleware ${label} antes da rota continuar.`;
  if (domain === 'servico') return `Executa a rotina de servico ${label} e devolve os dados para quem chamou.`;
  if (domain === 'script operacional') return `Executa a etapa ${lower} usada em verificacoes ou automacoes do projeto.`;
  if (domain === 'aplicativo mobile') return `Controla ${lower} dentro do aplicativo mobile.`;

  if (/^(get|buscar|obter)/i.test(name)) return `Busca ou monta os dados de ${lower} usados no fluxo atual.`;
  if (/^(is|has|needs|can)/i.test(name)) return `Verifica a condicao ${lower} e retorna um valor booleano.`;
  if (/^(set|update|atualizar)/i.test(name)) return `Atualiza ${lower} mantendo o estado persistido em sincronia.`;
  if (/^(handle|on|confirmar|pedir|alternar|toggle|abrir|fechar|copiar|copy)/i.test(name)) return `Processa a interacao de ${lower} e atualiza a interface conforme o resultado.`;
  if (/^(normalizar|normalize)/i.test(name)) return `Normaliza ${lower} para evitar divergencia de formato nas comparacoes.`;
  if (/^(validar|verify|require)/i.test(name)) return `Valida ${lower} antes de liberar a continuidade do fluxo.`;
  if (/^(gerar|generate|build|criar|create)/i.test(name)) return `Gera ${lower} com os dados necessarios para o proximo passo.`;
  if (/^(enviar|send)/i.test(name)) return `Envia ${lower} para o canal ou provedor configurado.`;
  if (/^(registrar|record|log)/i.test(name)) return `Registra ${lower} para auditoria, historico ou diagnostico.`;
  if (/^(limpar|clear)/i.test(name)) return `Limpa ${lower} para manter o estado consistente.`;
  if (/^(executar|run|main)/i.test(name)) return `Executa ${lower} coordenando as etapas principais desse fluxo.`;
  if (/^(format|formatar)/i.test(name)) return `Formata ${lower} para exibicao segura na interface.`;
  if (/^(escape|mascarar)/i.test(name)) return `Prepara ${lower} para exibicao sem expor dados sensiveis.`;
  if (/^(extrair|parse|read)/i.test(name)) return `Extrai ${lower} de uma entrada externa ou configuracao local.`;

  return `Concentra a logica de ${lower} para manter o restante do ${domain} mais legivel.`;
}

/**
 * Executa a etapa nearby comment info usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {number} index - Posição do item dentro da coleção atual.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function nearbyCommentInfo(lines, index) {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return { exists: false, detailed: false, current: false, legacyGenerated: false, text: '', start: -1, end: -1 };
  const line = lines[i].trim();
  const exists = line.startsWith('/**') || line.startsWith('/*') || line.startsWith('//') || line.startsWith('*');
  if (!exists) return { exists: false, detailed: false, current: false, legacyGenerated: false, text: '', start: -1, end: -1 };

  let start = i;
  if (line.startsWith('//')) {
    while (start > 0 && lines[start - 1].trim().startsWith('//')) start--;
  } else {
    while (start >= 0 && !lines[start].trim().startsWith('/**') && !lines[start].trim().startsWith('/*')) start--;
    while (start > 0 && lines[start - 1].trim().startsWith('//')) start--;
  }
  const safeStart = Math.max(0, start);
  const commentText = lines.slice(safeStart, i + 1).join('\n');
  const detailed = /@maintenance-generated/.test(commentText);
  const current = /@maintenance-generated v3\b/.test(commentText);
  const legacyGenerated = [
    /Agrupa o comportamento de/,
    /Renderiza a tela .* concentra as regras de apresentacao/,
    /Renderiza o componente .* encapsula sua interacao visual/,
    /Expõe o hook .* com estado e acoes compartilhadas/,
    /Executa o middleware .* antes da rota continuar/,
    /Executa a rotina de servico .* devolve os dados/,
    /Executa a etapa .* usada em verificacoes ou automacoes/,
    /Controla .* dentro do aplicativo mobile/,
    /Busca ou monta os dados de/,
    /Verifica a condicao .* retorna um valor booleano/,
    /Atualiza .* mantendo o estado persistido/,
    /Processa a interacao de/,
    /Normaliza .* evitar divergencia/,
    /Valida .* antes de liberar/,
    /Gera .* com os dados necessarios/,
    /Envia .* para o canal ou provedor/,
    /Registra .* para auditoria/,
    /Limpa .* para manter o estado consistente/,
    /Executa .* coordenando as etapas principais/,
    /Formata .* para exibicao segura/,
    /Prepara .* sem expor dados sensiveis/,
    /Extrai .* de uma entrada externa/,
    /Concentra a logica de/,
    /Endpoint (GET|POST|PUT|PATCH|DELETE) /,
  ].some((pattern) => pattern.test(commentText));
  return {
    exists: true,
    detailed,
    current,
    legacyGenerated,
    text: commentText,
    start: safeStart,
    end: i,
  };
}

/**
 * Recupera explicações manuais para incorporá-las ao contrato padronizado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} commentText - Valor de comment text consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function extractManualNotes(commentText = '') {
  return commentText
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*\/\*\*?\s?/, '')
      .replace(/^\s*\/\/\s?/, '')
      .replace(/^\s*\*\/?\s?/, '')
      .replace(/\s*\*\/\s*$/, '')
      .trim())
    .filter((line) => line && !line.startsWith('@'));
}

/**
 * Mantém apenas o resumo específico de um comentário detalhado de versão anterior.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} commentText - Valor de comment text consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function extractExistingSummary(commentText = '') {
  const notes = extractManualNotes(commentText);
  const summary = [];
  for (const note of notes) {
    if (/^(Responsabilidade|Fluxo principal|Efeitos colaterais):/.test(note)) break;
    summary.push(note);
  }
  return summary.join('\n');
}

/**
 * Converte uma assinatura simples em nomes que possam ser documentados em JSDoc.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador; registra ou remove listeners de eventos; publica ou consome mensagens MQTT
 *
 * @param {unknown} raw - Valor de raw consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function parseParameters(raw = '') {
  if (!raw.trim()) return [];
  if (raw.trim().startsWith('{')) {
    const properties = raw
      .trim()
      .replace(/^\{/, '')
      .replace(/\}$/, '')
      .split(',')
      .map((item) => item.trim().replace(/^\.\.\./, '').split(/[=:]/)[0].trim())
      .filter((item) => /^[A-Za-z_$][\w$]*$/.test(item));
    return ['options', ...properties.map((name) => `options.${name}`)];
  }
  if (raw.trim().startsWith('[')) return ['items'];
  return raw
    .split(',')
    .map((item) => item.trim().replace(/^\.\.\./, '').split('=')[0].trim())
    .filter((item) => /^[A-Za-z_$][\w$]*$/.test(item));
}

/**
 * Descreve o contrato de cada parâmetro com base no papel indicado pelo nome.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} name - Valor de name consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function describeParameter(name) {
  if (/^(props|options)\./.test(name)) {
    const property = name.split('.')[1];
    if (/^on[A-Z]/.test(property)) return ['Function', `Callback ${property} fornecido pelo componente responsável.`];
    if (/^(is|has|can)[A-Z]/.test(property)) return ['boolean', `Sinalizador ${property} que controla este comportamento visual.`];
    return ['unknown', `Propriedade ${property} usada para configurar dados ou comportamento do componente.`];
  }
  if (/^(e|event|evento)$/i.test(name)) return ['Event', 'Evento que iniciou a interação ou mudança de estado.'];
  if (/^(req|request)$/i.test(name)) return ['import("express").Request', 'Requisição HTTP com parâmetros, corpo e contexto de autenticação.'];
  if (/^(res|response)$/i.test(name)) return ['import("express").Response', 'Resposta HTTP usada para devolver o resultado ao cliente.'];
  if (/^next$/i.test(name)) return ['import("express").NextFunction', 'Continuação da cadeia de middlewares do Express.'];
  if (/^(id|.*Id|.*_id)$/i.test(name)) return ['string|number', 'Identificador do registro ou recurso processado.'];
  if (/^(index|indice)$/i.test(name)) return ['number', 'Posição do item dentro da coleção atual.'];
  if (/^(error|erro)$/i.test(name)) return ['Error|unknown', 'Falha capturada durante a execução do fluxo.'];
  if (/^(callback|on[A-Z].*)$/.test(name)) return ['Function', 'Função chamada para comunicar o resultado ao componente responsável.'];
  if (/^(options|config|props)$/i.test(name)) return ['object', 'Configurações e dados necessários para executar este bloco.'];
  if (/^(data|dados|payload|body)$/i.test(name)) return ['object|Array', 'Dados de entrada que serão validados e transformados pelo fluxo.'];
  if (/^(user|usuario)$/i.test(name)) return ['object', 'Usuário autenticado ou candidato à autenticação processado por esta rotina.'];
  if (/^(prev|previous|anterior)$/i.test(name)) return ['unknown', 'Valor anterior usado para produzir uma atualização imutável.'];
  if (/^(code|codigo|token)$/i.test(name)) return ['string', 'Código de verificação ou credencial temporária recebida pelo fluxo.'];
  return ['unknown', `Valor de ${titleFromName(name).toLowerCase()} consumido por esta rotina.`];
}

/**
 * Recorta somente o corpo local para não atribuir efeitos da função seguinte.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {number} index - Posição do item dentro da coleção atual.
 * @param {unknown} expressionBody - Valor de expression body consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function collectFunctionSnippet(lines, index, expressionBody) {
  if (expressionBody) return lines[index];
  const collected = [];
  let balance = 0;
  let started = false;
  for (let i = index; i < Math.min(lines.length, index + 160); i++) {
    const line = lines[i];
    collected.push(line);
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    if (opens > 0) started = true;
    balance += opens - closes;
    if (started && balance <= 0) break;
  }
  return collected.join('\n');
}

/**
 * Analisa um trecho local para registrar fluxo, integrações e efeitos colaterais reais.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador; registra ou remove listeners de eventos; publica ou consome mensagens MQTT
 *
 * @param {unknown} match - Valor de match consumido por esta rotina.
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {number} index - Posição do item dentro da coleção atual.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function analyzeFunction(match, file, lines, index) {
  const snippet = collectFunctionSnippet(lines, index, match.expressionBody);
  const domain = domainFromPath(file);
  const effects = [];
  const flow = [];

  if (/\bif\s*\(|\bswitch\s*\(/.test(snippet)) flow.push('Valida as condições de entrada e interrompe caminhos que não podem prosseguir.');
  if (/\btry\s*{/.test(snippet)) flow.push('Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.');
  if (/\.map\(|\.filter\(|\.reduce\(/.test(snippet)) flow.push('Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.');
  if (/return\s*\(/.test(snippet) && (domain === 'tela' || domain === 'componente' || domain === 'aplicativo mobile')) {
    flow.push('Monta a árvore visual conforme o estado e as permissões disponíveis.');
  }
  if (match.async) flow.push('Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.');
  if (flow.length === 0) flow.push('Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.');

  if (/\bset[A-Z][A-Za-z0-9_]*\s*\(/.test(snippet)) effects.push('atualiza estado reativo da interface');
  if (/\b(api|axios)\.(get|post|put|patch|delete)|\bfetch\s*\(/.test(snippet)) effects.push('consulta ou altera dados pela API');
  if (/localStorage|sessionStorage/.test(snippet)) effects.push('lê ou grava preferências no armazenamento do navegador');
  if (/window\.|document\./.test(snippet)) effects.push('interage com APIs do navegador');
  if (/addEventListener|removeEventListener/.test(snippet)) effects.push('registra ou remove listeners de eventos');
  if (/\bsocket\.|\.emit\(|\.on\(/.test(snippet)) effects.push('troca eventos em tempo real');
  if (/\bpool\.|\.query\s*\(/.test(snippet)) effects.push('acessa a camada de persistência');
  if (/\bmqtt\b|\.publish\s*\(|\.subscribe\s*\(/i.test(snippet)) effects.push('publica ou consome mensagens MQTT');
  if (/\bfs\./.test(snippet)) effects.push('lê ou grava arquivos locais');
  if (/\bres\.(status|json|send|end)\s*\(/.test(snippet)) effects.push('finaliza a resposta HTTP');
  if (/console\.(log|warn|error)/.test(snippet)) effects.push('registra informações de diagnóstico');

  const isComponent = match.name === fileBaseName(file)
    && (['.jsx', '.tsx'].includes(path.extname(file)) || domain === 'aplicativo mobile');
  let returns = 'void';
  let returnDescription = 'Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.';
  if (isComponent) {
    returns = 'React.ReactElement';
    returnDescription = 'Árvore de elementos que representa o componente na interface.';
  } else if (match.kind === 'class') {
    returns = match.name;
    returnDescription = 'Instância responsável por encapsular estado e comportamento do módulo.';
  } else if (/^(is|has|needs|can)/i.test(match.name)) {
    returns = match.async ? 'Promise<boolean>' : 'boolean';
    returnDescription = 'Indica se a condição avaliada foi atendida.';
  } else if (match.expressionBody || /\breturn\s+[^;\n}]+/.test(snippet)) {
    returns = match.async ? 'Promise<unknown>' : 'unknown';
    returnDescription = 'Resultado calculado para consumo do chamador.';
  } else if (match.async) {
    returns = 'Promise<void>';
    returnDescription = 'Promise concluída quando todas as etapas assíncronas terminam.';
  }

  return { effects, flow, isComponent, returns, returnDescription };
}

/**
 * Monta a documentação detalhada e padronizada de uma função, classe ou componente.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} match - Valor de match consumido por esta rotina.
 * @param {unknown} file - Valor de file consumido por esta rotina.
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {number} index - Posição do item dentro da coleção atual.
 * @param {unknown} manualText - Valor de manual text consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function detailedComment(match, file, lines, index, manualText = '') {
  const analysis = analyzeFunction(match, file, lines, index);
  const indent = match.indent;
  const manualNotes = extractManualNotes(manualText);
  const parameters = analysis.isComponent
    ? match.parameters.map((parameter) => parameter.replace(/^options(?=\.|$)/, 'props'))
    : match.parameters;
  const output = [
    `${indent}/**`,
    ...((manualNotes.length > 0 ? manualNotes : [describe(match.name, file, match.kind)])
      .map((line) => `${indent} * ${line}`)),
    `${indent} *`,
    `${indent} * Responsabilidade: mantém este comportamento isolado para que validação,`,
    `${indent} * atualização de estado e integração possam evoluir sem duplicação em outros blocos.`,
    `${indent} *`,
    `${indent} * Fluxo principal:`,
    ...analysis.flow.map((step) => `${indent} * - ${step}`),
  ];

  output.push(`${indent} *`);
  output.push(`${indent} * Efeitos colaterais: ${analysis.effects.length > 0 ? analysis.effects.join('; ') : 'não possui efeitos externos identificados; opera apenas sobre os valores recebidos.'}`);
  output.push(`${indent} *`);
  for (const parameter of parameters) {
    const [type, description] = describeParameter(parameter);
    output.push(`${indent} * @param {${type}} ${parameter} - ${description}`);
  }
  output.push(`${indent} * @returns {${analysis.returns}} ${analysis.returnDescription}`);
  output.push(`${indent} * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.`);
  output.push(`${indent} */`);
  return output;
}

/**
 * Executa a etapa get match usada em verificacoes ou automacoes do projeto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: lê ou grava arquivos locais; registra informações de diagnóstico
 *
 * @param {unknown} lines - Valor de lines consumido por esta rotina.
 * @param {number} index - Posição do item dentro da coleção atual.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getMatch(lines, index) {
  const line = lines[index];
  const signature = lines.slice(index, index + 16).join(' ');
  const fn = signature.match(/^(\s*)(export\s+default\s+|export\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)\s*\((.*?)\)\s*{/);
  if (fn) return { indent: fn[1], name: fn[4], kind: 'function', async: Boolean(fn[3]), parameters: parseParameters(fn[5]) };

  const arrow = signature.match(/^(\s*)(export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(async\s*)?(?:\((.*?)\)|([A-Za-z0-9_]+))\s*=>(.*)$/);
  if (arrow) return {
    indent: arrow[1],
    name: arrow[3],
    kind: 'function',
    async: Boolean(arrow[4]),
    parameters: parseParameters(arrow[5] || arrow[6] || ''),
    expressionBody: !arrow[7].trim().startsWith('{'),
  };

  const cls = line.match(/^(\s*)(export\s+default\s+|export\s+)?class\s+([A-Za-z0-9_]+)/);
  if (cls) return { indent: cls[1], name: cls[3], kind: 'class', async: false, parameters: [] };

  return null;
}

/**
 * Identifica declarações Express para documentar contratos HTTP anônimos.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} line - Valor de line consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getRouteMatch(line) {
  const route = line.match(/^(\s*)app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
  if (!route) return null;
  return { indent: route[1], method: route[2].toUpperCase(), path: route[3] };
}

/**
 * Produz o contrato de uma rota com autenticação, validação e efeitos observáveis.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} route - Valor de route consumido por esta rotina.
 * @param {unknown} line - Valor de line consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function detailedRouteComment(route, line) {
  const indent = route.indent;
  const protections = [];
  if (/verificarToken|requirePermission|requireRoles/.test(line)) protections.push('autenticação e autorização');
  if (/upload\.|multer/.test(line)) protections.push('recebimento controlado de arquivo');
  const protectionText = protections.length > 0
    ? protections.join(' e ')
    : 'validação executada pelo próprio handler';
  return [
    `${indent}/**`,
    `${indent} * Endpoint ${route.method} ${route.path}.`,
    `${indent} *`,
    `${indent} * Responsabilidade: recebe a requisição, aplica ${protectionText},`,
    `${indent} * delega a regra de negócio e devolve um contrato HTTP serializável.`,
    `${indent} * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.`,
    `${indent} * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.`,
    `${indent} * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.`,
    `${indent} *`,
    `${indent} * @route ${route.method} ${route.path}`,
    `${indent} * @maintenance-generated v3 - Contrato documental do endpoint Express.`,
    `${indent} */`,
  ];
}

let changed = 0;
let skipped = 0;

for (const file of targets.flatMap((dir) => walk(path.join(root, dir)))) {
  const original = fs.readFileSync(file, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const extension = path.extname(file);
  const out = hasModuleHeader(lines, extension) ? [] : moduleHeader(file);

  for (let i = 0; i < lines.length; i++) {
    const match = codeExts.has(extension) ? getMatch(lines, i) : null;
    if (match) {
      const comment = nearbyCommentInfo(lines, i);
      if (comment.exists && !comment.current) {
        const previousLineSpan = i - comment.start;
        const removeCount = comment.end - comment.start + 1;
        out.splice(out.length - previousLineSpan, removeCount);
      }
      if (!comment.exists || !comment.current) {
        const manualText = comment.detailed
          ? (comment.legacyGenerated ? '' : extractExistingSummary(comment.text))
          : (comment.exists && !comment.legacyGenerated ? comment.text : '');
        out.push(...detailedComment(match, file, lines, i, manualText));
      }
    }

    const route = codeExts.has(extension) ? getRouteMatch(lines[i]) : null;
    if (route) {
      const comment = nearbyCommentInfo(lines, i);
      if (comment.detailed && !comment.current) {
        const previousLineSpan = i - comment.start;
        const removeCount = comment.end - comment.start + 1;
        out.splice(out.length - previousLineSpan, removeCount);
      }
      if (!comment.exists || !comment.current || !/@route\s/.test(comment.text || '')) {
        out.push(...detailedRouteComment(route, lines[i]));
      }
    }
    out.push(lines[i]);
  }

  const next = out.join(eol);
  if (next !== original) {
    try {
      fs.writeFileSync(file, next);
      changed++;
    } catch (error) {
      skipped++;
      console.warn(`Nao foi possivel atualizar ${path.relative(root, file)}: ${error.code || error.message}`);
    }
  }
}

console.log(`Comentarios de manutencao aplicados em ${changed} arquivo(s).`);
if (skipped > 0) {
  console.log(`Arquivos ignorados por bloqueio de escrita: ${skipped}.`);
}
