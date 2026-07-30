import type { PhaseCounts, SolveStep } from '../api/types.ts';
import type { LpStep } from './simplex/types.ts';
import { Simplex } from './simplex/Simplex.ts';

function isPivotStep(step: LpStep): boolean {
  return step.enter !== null;
}

export function collectTaggedSteps(problem: Simplex): {
  tagged: Array<[LpStep, string, number]>;
  phaseCounts: PhaseCounts;
} {
  const tagged: Array<[LpStep, string, number]> = [];
  let phaseOneCount = 0;
  let phaseTwoCount = 0;

  const appendStep = (step: LpStep, phase: string): void => {
    let phaseIteration = 0;
    if (phase === 'phase_one') {
      if (isPivotStep(step)) {
        phaseOneCount += 1;
        phaseIteration = phaseOneCount;
      }
    } else if (isPivotStep(step)) {
      phaseTwoCount += 1;
      phaseIteration = phaseTwoCount;
    }
    tagged.push([step, phase, phaseIteration]);
  };

  if (problem.autoTwoPhase && problem.requiresPhaseOne()) {
    for (const step of problem.twoPhase()) {
      appendStep(step, 'phase_one');
    }
    for (const step of problem.solve()) {
      appendStep(step, 'phase_two');
    }
  } else {
    for (const step of problem.solve()) {
      appendStep(step, 'phase_two');
    }
  }

  return {
    tagged,
    phaseCounts: {
      phase_one: phaseOneCount,
      phase_two: phaseTwoCount,
      total: phaseOneCount + phaseTwoCount,
    },
  };
}

export function encodeStep(
  index: number,
  step: LpStep,
  phase: string,
  phaseIteration: number,
): SolveStep {
  const payload: SolveStep = {
    index,
    enter: step.enter?.name ?? null,
    leave: step.leave?.name ?? null,
    tableau: step.tableau.toFrame(),
    phase,
  };
  if (phaseIteration > 0) {
    payload.phase_iteration = phaseIteration;
  }
  return payload;
}
