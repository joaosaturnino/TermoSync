/**
 * Impede que arquivos sensíveis ou dependências instaladas sejam versionados.
 *
 * A validação consulta apenas o índice do Git e nunca abre ou imprime o conteúdo
 * dos arquivos encontrados. Assim, ela pode rodar no CI sem expor credenciais.
 */

const { execFileSync } = require('node:child_process');

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return output.split('\0').filter(Boolean).map((file) => file.replaceAll('\\', '/'));
}

function isEnvironmentSecret(file) {
  const name = file.split('/').at(-1);
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example');
}

function main() {
  let trackedFiles;

  try {
    trackedFiles = listTrackedFiles();
  } catch (error) {
    const message = error.stderr?.trim() || error.message;
    console.error(`[REPOSITORY] Não foi possível consultar o índice do Git: ${message}`);
    process.exitCode = 1;
    return;
  }

  const sensitiveFiles = trackedFiles.filter(isEnvironmentSecret);
  const installedDependencies = trackedFiles.filter((file) => file.split('/').includes('node_modules'));

  if (sensitiveFiles.length === 0 && installedDependencies.length === 0) {
    console.log('[REPOSITORY] Higiene validada: nenhum segredo ou node_modules está versionado.');
    return;
  }

  if (sensitiveFiles.length > 0) {
    console.error(`[REPOSITORY] Arquivos de ambiente versionados: ${sensitiveFiles.join(', ')}`);
  }

  if (installedDependencies.length > 0) {
    console.error(`[REPOSITORY] Há ${installedDependencies.length} arquivo(s) de node_modules no índice do Git.`);
  }

  console.error('[REPOSITORY] Remova esses caminhos do índice antes de continuar.');
  process.exitCode = 1;
}

main();
