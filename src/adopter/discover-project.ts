import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const TargetPathSchema = z.string().trim().min(1, 'O diretório alvo é obrigatório');

const PackageJsonSchema = z
  .object({
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

const StackNameSchema = z.enum(['flutter', 'typescript', 'python', 'rust', 'unknown']);
const ProfileSchema = z.enum(['flutter', 'typescript', 'python', 'rust', 'core']);

export const AdoptionReportSchema = z.object({
  mode: z.literal('dry-run'),
  target: z.string(),
  detectedStacks: z.array(
    z.object({
      name: StackNameSchema,
      evidence: z.array(z.string()),
    })
  ),
  recommendedProfile: ProfileSchema,
  git: z.object({
    status: z.enum(['clean', 'dirty', 'unavailable', 'not-repository']),
  }),
  governance: z.object({
    agentsInstructions: z.boolean(),
    specs: z.boolean(),
    commandInterface: z.boolean(),
    continuousIntegration: z.boolean(),
  }),
  conflicts: z.array(z.string()),
  proposedActions: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type AdoptionReport = z.infer<typeof AdoptionReportSchema>;
type StackName = z.infer<typeof StackNameSchema>;
type Profile = z.infer<typeof ProfileSchema>;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function assertDirectory(rawTarget: string): Promise<string> {
  const target = resolve(TargetPathSchema.parse(rawTarget));
  let targetStat;
  try {
    targetStat = await stat(target);
  } catch {
    throw new Error(`O diretório alvo não existe ou não está acessível: ${target}`);
  }
  if (!targetStat.isDirectory()) {
    throw new Error(`O path alvo não é um diretório: ${target}`);
  }
  return target;
}

function addEvidence(
  evidence: Map<Exclude<StackName, 'unknown'>, string[]>,
  stack: Exclude<StackName, 'unknown'>,
  value: string
): void {
  evidence.get(stack)?.push(value);
}

async function inspectPackageJson(
  target: string,
  evidence: Map<Exclude<StackName, 'unknown'>, string[]>,
  warnings: string[]
): Promise<void> {
  const packagePath = join(target, 'package.json');
  if (!(await exists(packagePath))) return;

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(packagePath, 'utf8'));
  } catch {
    warnings.push('package.json não contém JSON válido; ignorado na deteção');
    return;
  }

  const parsed = PackageJsonSchema.safeParse(raw);
  if (!parsed.success) {
    warnings.push('package.json não cumpre a estrutura esperada; ignorado na deteção');
    return;
  }

  if (parsed.data.dependencies && Object.hasOwn(parsed.data.dependencies, 'typescript')) {
    addEvidence(evidence, 'typescript', 'package.json:dependencies.typescript');
  }
  if (parsed.data.devDependencies && Object.hasOwn(parsed.data.devDependencies, 'typescript')) {
    addEvidence(evidence, 'typescript', 'package.json:devDependencies.typescript');
  }
}

async function detectStacks(
  target: string,
  warnings: string[]
): Promise<AdoptionReport['detectedStacks']> {
  const evidence = new Map<Exclude<StackName, 'unknown'>, string[]>([
    ['flutter', []],
    ['typescript', []],
    ['python', []],
    ['rust', []],
  ]);

  await inspectPackageJson(target, evidence, warnings);
  if (await exists(join(target, 'tsconfig.json')))
    addEvidence(evidence, 'typescript', 'tsconfig.json');
  if (await exists(join(target, 'pyproject.toml')))
    addEvidence(evidence, 'python', 'pyproject.toml');
  if (await exists(join(target, 'requirements.txt')))
    addEvidence(evidence, 'python', 'requirements.txt');
  if (await exists(join(target, 'Cargo.toml'))) addEvidence(evidence, 'rust', 'Cargo.toml');

  const pubspecPath = join(target, 'pubspec.yaml');
  if (await exists(pubspecPath)) {
    const pubspec = await readFile(pubspecPath, 'utf8');
    if (/^\s*flutter:\s*$/mu.test(pubspec))
      addEvidence(evidence, 'flutter', 'pubspec.yaml:flutter');
  }

  const detected = [...evidence.entries()]
    .filter((entry) => entry[1].length > 0)
    .map(([name, stackEvidence]) => ({ name, evidence: stackEvidence }));
  return detected.length > 0 ? detected : [{ name: 'unknown', evidence: [] }];
}

function recommendedProfile(stacks: AdoptionReport['detectedStacks']): Profile {
  const priority: readonly Exclude<StackName, 'unknown'>[] = [
    'flutter',
    'typescript',
    'python',
    'rust',
  ];
  return priority.find((candidate) => stacks.some(({ name }) => name === candidate)) ?? 'core';
}

async function inspectGit(target: string, warnings: string[]): Promise<AdoptionReport['git']> {
  const gitMarker = await exists(join(target, '.git'));
  try {
    execFileSync('git', ['-C', target, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const status = execFileSync('git', ['-C', target, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return { status: status.trim() === '' ? 'clean' : 'dirty' };
  } catch {
    if (gitMarker) {
      warnings.push('Estado Git indisponível; verifica permissões e safe.directory');
      return { status: 'unavailable' };
    }
    return { status: 'not-repository' };
  }
}

async function inspectGovernance(target: string): Promise<AdoptionReport['governance']> {
  return {
    agentsInstructions: await exists(join(target, 'AGENTS.md')),
    specs: await exists(join(target, 'specs')),
    commandInterface: await exists(join(target, 'Makefile')),
    continuousIntegration: await exists(join(target, '.github', 'workflows')),
  };
}

function listConflicts(governance: AdoptionReport['governance']): string[] {
  const conflicts: string[] = [];
  if (governance.agentsInstructions) conflicts.push('AGENTS.md');
  if (governance.commandInterface) conflicts.push('Makefile');
  if (governance.specs) conflicts.push('specs/');
  if (governance.continuousIntegration) conflicts.push('.github/workflows/');
  return conflicts;
}

function proposeActions(
  governance: AdoptionReport['governance'],
  profile: Profile,
  conflicts: string[]
): string[] {
  const actions: string[] = [];
  if (!governance.agentsInstructions) actions.push('Criar AGENTS.md a partir do core AI-SDD');
  if (!governance.specs) actions.push('Instalar corpus de specs e respetivo validador');
  if (!governance.commandInterface) actions.push('Adicionar interface única de comandos');
  if (!governance.continuousIntegration) actions.push('Adicionar gates AI-SDD ao CI');
  if (conflicts.length > 0) actions.push('Reconciliar artefactos existentes sem os substituir');
  actions.push(`Preparar profile ${profile}`);
  return actions;
}

export async function discoverProject(rawTarget: string): Promise<AdoptionReport> {
  const target = await assertDirectory(rawTarget);
  const warnings: string[] = [];
  const detectedStacks = await detectStacks(target, warnings);
  const profile = recommendedProfile(detectedStacks);
  const governance = await inspectGovernance(target);
  const conflicts = listConflicts(governance);

  return AdoptionReportSchema.parse({
    mode: 'dry-run',
    target,
    detectedStacks,
    recommendedProfile: profile,
    git: await inspectGit(target, warnings),
    governance,
    conflicts,
    proposedActions: proposeActions(governance, profile, conflicts),
    warnings,
  });
}
