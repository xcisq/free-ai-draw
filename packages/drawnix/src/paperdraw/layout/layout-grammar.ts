export type LayoutGrammarKind = 'H' | 'V' | 'D' | 'COMPOSITE';

export interface LayoutVariant {
  id: string;
  grammar: LayoutGrammarKind;
  mainDirection: 'LR' | 'TB';
  branchStyle: 'stack' | 'spread' | 'diagonal';
  spacingScale: number;
  secondarySpacingScale: number;
  gridBias: 'compact' | 'balanced';
}

export function getLayoutVariants(
  mainDirection: 'LR' | 'TB',
  limit: number
): LayoutVariant[] {
  const grammarSeed: LayoutVariant[] =
    mainDirection === 'LR'
      ? [
          {
            id: 'h-balanced',
            grammar: 'H',
            mainDirection,
            branchStyle: 'stack',
            spacingScale: 1,
            secondarySpacingScale: 1,
            gridBias: 'balanced',
          },
          {
            id: 'h-compact',
            grammar: 'H',
            mainDirection,
            branchStyle: 'stack',
            spacingScale: 0.9,
            secondarySpacingScale: 0.9,
            gridBias: 'compact',
          },
          {
            id: 'h-spread',
            grammar: 'H',
            mainDirection,
            branchStyle: 'spread',
            spacingScale: 1.15,
            secondarySpacingScale: 1,
            gridBias: 'balanced',
          },
          {
            id: 'composite-diagonal',
            grammar: 'COMPOSITE',
            mainDirection,
            branchStyle: 'diagonal',
            spacingScale: 1,
            secondarySpacingScale: 1.1,
            gridBias: 'balanced',
          },
          {
            id: 'diagonal-compact',
            grammar: 'D',
            mainDirection,
            branchStyle: 'diagonal',
            spacingScale: 0.95,
            secondarySpacingScale: 0.9,
            gridBias: 'compact',
          },
        ]
      : [
          {
            id: 'v-balanced',
            grammar: 'V',
            mainDirection,
            branchStyle: 'stack',
            spacingScale: 1,
            secondarySpacingScale: 1,
            gridBias: 'balanced',
          },
          {
            id: 'v-compact',
            grammar: 'V',
            mainDirection,
            branchStyle: 'stack',
            spacingScale: 0.9,
            secondarySpacingScale: 0.9,
            gridBias: 'compact',
          },
          {
            id: 'v-spread',
            grammar: 'V',
            mainDirection,
            branchStyle: 'spread',
            spacingScale: 1.1,
            secondarySpacingScale: 1.05,
            gridBias: 'balanced',
          },
          {
            id: 'composite-vertical',
            grammar: 'COMPOSITE',
            mainDirection,
            branchStyle: 'spread',
            spacingScale: 1,
            secondarySpacingScale: 1.15,
            gridBias: 'balanced',
          },
          {
            id: 'diagonal-vertical',
            grammar: 'D',
            mainDirection,
            branchStyle: 'diagonal',
            spacingScale: 1,
            secondarySpacingScale: 0.95,
            gridBias: 'compact',
          },
        ];

  const variants: LayoutVariant[] = [];
  while (variants.length < limit) {
    const seed = grammarSeed[variants.length % grammarSeed.length];
    const cycle = Math.floor(variants.length / grammarSeed.length);
    variants.push({
      ...seed,
      id: `${seed.id}-${cycle}`,
      spacingScale: Number((seed.spacingScale + cycle * 0.05).toFixed(2)),
      secondarySpacingScale: Number(
        (seed.secondarySpacingScale + (cycle % 2 === 0 ? 0 : 0.05)).toFixed(2)
      ),
    });
  }
  return variants;
}
