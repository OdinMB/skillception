import type { Step } from '../types'

interface Props {
  steps: Step[]
}

function LevelLabel({ level }: { level: number }) {
  if (level <= 2) {
    return <>{['SC', 'SCC', 'SCCC'][level]}</>
  }
  return (
    <>
      SC<sup>{level + 1}</sup>
    </>
  )
}

export default function StepTrace({ steps }: Props) {
  return (
    <div className="step-trace">
      {steps.map((step) => (
        <div className="step" key={step.step_index}>
          <span className="step-idx">{step.step_index}</span>
          <span className={`step-dir ${step.direction}`}>{step.direction}</span>
          <span className="step-levels">
            <LevelLabel level={step.source_level} />
            {' \u2192 '}
            <LevelLabel level={step.target_level} />
            {' '}
            <span style={{ color: 'var(--color-caption)' }}>
              (level {step.source_level} \u2192 {step.target_level})
            </span>
          </span>
          <span className={`step-result ${step.passed ? 'pass' : 'fail'}`}>
            {step.passed ? 'PASS' : 'FAIL'}
          </span>
        </div>
      ))}
    </div>
  )
}
