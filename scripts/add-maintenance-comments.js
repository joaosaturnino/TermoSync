const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = ['backend', 'frontend/src', 'mobile', 'scripts'];
const exts = new Set(['.js', '.jsx']);
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
 */
function titleFromName(name) {
  return name
    .replace(/^use/, 'use ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Retorna o nome do arquivo sem extensao para detectar componentes principais.
 */
function fileBaseName(file) {
  return path.basename(file, path.extname(file));
}

/**
 * Executa a etapa domain from path usada em verificacoes ou automacoes do projeto.
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
 * Executa a etapa describe usada em verificacoes ou automacoes do projeto.
 */
function describe(name, file, kind) {
  const label = titleFromName(name || kind || 'funcao');
  const domain = domainFromPath(file);
  const lower = label.toLowerCase();
  const isMainPageComponent = domain === 'tela' && name === fileBaseName(file);

  if (kind === 'class') return `Agrupa o comportamento de ${label} para isolar estado, renderizacao e tratamento de erro.`;
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
 * Executa a etapa has nearby comment usada em verificacoes ou automacoes do projeto.
 */
function nearbyCommentInfo(lines, index) {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return { exists: false, generic: false, start: -1, end: -1 };
  const line = lines[i].trim();
  const exists = line.startsWith('/**') || line.startsWith('/*') || line.startsWith('//') || line.startsWith('*');
  if (!exists) return { exists: false, generic: false, start: -1, end: -1 };

  let start = i;
  while (start >= 0 && !lines[start].trim().startsWith('/**') && !lines[start].trim().startsWith('//')) {
    start--;
  }
  const safeStart = Math.max(0, start);
  const commentText = lines.slice(safeStart, i + 1).join('\n');
  return {
    exists: true,
    generic: /concentra as regras de apresentacao desse modulo/.test(commentText),
    start: safeStart,
    end: i,
  };
}

/**
 * Executa a etapa get match usada em verificacoes ou automacoes do projeto.
 */
function getMatch(line) {
  const fn = line.match(/^(\s*)(export\s+default\s+|export\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)/);
  if (fn) return { indent: fn[1], name: fn[4], kind: 'function' };

  const arrow = line.match(/^(\s*)(export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/);
  if (arrow) return { indent: arrow[1], name: arrow[3], kind: 'function' };

  const cls = line.match(/^(\s*)(export\s+default\s+|export\s+)?class\s+([A-Za-z0-9_]+)/);
  if (cls) return { indent: cls[1], name: cls[3], kind: 'class' };

  return null;
}

let changed = 0;
let skipped = 0;

for (const file of targets.flatMap((dir) => walk(path.join(root, dir)))) {
  const original = fs.readFileSync(file, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const match = getMatch(lines[i]);
    if (match) {
      const comment = nearbyCommentInfo(lines, i);
      if (comment.generic) {
        const previousLineSpan = i - comment.start;
        const removeCount = comment.end - comment.start + 1;
        out.splice(out.length - previousLineSpan, removeCount);
      }
      if (!comment.exists || comment.generic) {
        out.push(`${match.indent}/**`);
        out.push(`${match.indent} * ${describe(match.name, file, match.kind)}`);
        out.push(`${match.indent} */`);
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
