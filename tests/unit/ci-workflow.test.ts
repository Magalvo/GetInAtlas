import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const WorkflowTriggers = z.object({
  on: z.object({
    pull_request: z.object({ types: z.array(z.string()) }),
  }),
});

describe('workflow de CI (WI-0013)', () => {
  it('AC1: volta a correr quando uma label de aprovação humana muda', async () => {
    const workflow = WorkflowTriggers.parse(
      parseYaml(await readFile(resolve('.github/workflows/ci.yml'), 'utf8'))
    );

    expect(workflow.on.pull_request.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'labeled', 'unlabeled'])
    );
  });
});
