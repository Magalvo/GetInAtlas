import { z } from 'zod';
import { applyCore, type ApplyCoreResult } from './apply-core.js';
import { applyTypescriptProfile, type ApplyTypescriptResult } from './apply-typescript-profile.js';
import { discoverProject, type AdoptionReport } from './discover-project.js';

const RawArgumentsSchema = z.array(z.string());
const ProfileArgumentSchema = z.enum(['core', 'typescript', 'auto']);

export interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

interface ParsedArguments {
  target: string;
  json: boolean;
  apply: boolean;
  profile: z.infer<typeof ProfileArgumentSchema>;
}

const usage = 'Uso: ai-sdd adopt <diretório> [--apply] [--profile core|typescript|auto] [--json]';

function parseArguments(rawArguments: readonly string[]): ParsedArguments {
  const args = RawArgumentsSchema.parse(rawArguments);
  if (args[0] !== 'adopt') throw new Error('Comando esperado: adopt');

  let target: string | undefined;
  let json = false;
  let apply = false;
  let profile: z.infer<typeof ProfileArgumentSchema> = 'core';
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    if (argument === '--json') {
      json = true;
    } else if (argument === '--apply') {
      apply = true;
    } else if (argument === '--profile') {
      profile = ProfileArgumentSchema.parse(args[index + 1]);
      index += 1;
    } else if (argument.startsWith('--profile=')) {
      profile = ProfileArgumentSchema.parse(argument.slice('--profile='.length));
    } else if (argument.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${argument}`);
    } else if (target) {
      throw new Error(`Argumento inesperado: ${argument}`);
    } else {
      target = argument;
    }
  }
  if (!target) throw new Error('O diretório alvo é obrigatório');
  return { target, json, apply, profile };
}

function formatApplyResult(result: ApplyCoreResult): string {
  if (result.status === 'unchanged') {
    return 'Core AI-SDD já estava aplicado; nenhuma alteração.\n';
  }
  return `Core AI-SDD aplicado.\nFicheiros criados: ${result.createdFiles.join(', ')}\n`;
}

function formatTypescriptResult(result: ApplyTypescriptResult): string {
  const action = result.status === 'unchanged' ? 'já estava aplicado' : 'aplicado';
  return `Profile TypeScript ${action}. Readiness: ${result.readiness}.\n`;
}

function formatHumanReport(report: AdoptionReport): string {
  const stacks = report.detectedStacks.map(({ name }) => name).join(', ');
  const conflicts = report.conflicts.length > 0 ? report.conflicts.join(', ') : 'nenhum';
  const actions = report.proposedActions.map((action) => `  - ${action}`).join('\n');
  const warnings = report.warnings.map((warning) => `  - ${warning}`).join('\n');

  return [
    'Plano de adoção (dry-run)',
    `Alvo: ${report.target}`,
    `Stacks detetadas: ${stacks}`,
    `Profile recomendado: ${report.recommendedProfile}`,
    `Git: ${report.git.status}`,
    `Conflitos: ${conflicts}`,
    'Ações propostas:',
    actions,
    ...(warnings === '' ? [] : ['Warnings:', warnings]),
    'Nenhum ficheiro foi alterado.',
    '',
  ].join('\n');
}

export async function runAdopterCli(rawArguments: readonly string[], io: CliIo): Promise<number> {
  try {
    const args = parseArguments(rawArguments);
    if (args.apply) {
      let selectedProfile = args.profile;
      if (selectedProfile === 'auto') {
        const report = await discoverProject(args.target);
        selectedProfile = report.recommendedProfile === 'typescript' ? 'typescript' : 'core';
      }
      if (selectedProfile === 'typescript') {
        const result = await applyTypescriptProfile(args.target);
        io.stdout(
          args.json ? `${JSON.stringify(result, null, 2)}\n` : formatTypescriptResult(result)
        );
        return 0;
      }
      const result = await applyCore(args.target);
      io.stdout(args.json ? `${JSON.stringify(result, null, 2)}\n` : formatApplyResult(result));
      return 0;
    }
    const report = await discoverProject(args.target);
    io.stdout(args.json ? `${JSON.stringify(report, null, 2)}\n` : formatHumanReport(report));
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    io.stderr(`${message}\n${usage}\n`);
    return 2;
  }
}
