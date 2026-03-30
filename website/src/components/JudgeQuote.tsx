import type { Step } from '../types'

interface Props {
  step: Step
  category: string
}

export default function JudgeQuote({ step, category }: Props) {
  return (
    <>
      <h3>{category}</h3>
      <div className="judge-quote">
        &ldquo;{step.judge_result.reasoning}&rdquo;
        <div className="attribution">
          &mdash; Judge, step {step.step_index} (level {step.judge_result.detected_level} detection)
        </div>
      </div>
    </>
  )
}
