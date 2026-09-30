/** Automatiza a rotina operacional check firmware. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const databasePath = path.join(root, '.build', 'compile_commands.json');
const sketchPath = path.join(root, 'backend', 'arduino', 'sensor', 'sensor.ino');

if (!fs.existsSync(databasePath)) {
  console.error('compile_commands.json ausente. Compile o sketch uma vez pela extensão Arduino.');
  process.exit(2);
}

const commands = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
const entry = commands.find((item) => /sensor\.ino\.cpp$/i.test(item.file));
if (!entry?.arguments?.length) {
  console.error('Comando de compilação do sensor não encontrado.');
  process.exit(2);
}

const args = [...entry.arguments.slice(1)];
const sourceIndex = args.findIndex((arg) => /sensor\.ino\.cpp$/i.test(arg));
const outputFlag = args.indexOf('-o');
if (sourceIndex < 0 || outputFlag < 0 || !args[outputFlag + 1]) {
  console.error('Formato inesperado no banco de compilação.');
  process.exit(2);
}

args.splice(sourceIndex, 1, '-x', 'c++', sketchPath);
const updatedOutputFlag = args.indexOf('-o');
const outputPath = path.join(root, '.build', 'sketch', 'sensor.check.o');
args[updatedOutputFlag + 1] = outputPath;

const result = spawnSync(entry.arguments[0], args, {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe'
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
if (result.error) {
  console.error(result.error.message);
  process.exit(2);
}
process.exit(result.status ?? 1);
