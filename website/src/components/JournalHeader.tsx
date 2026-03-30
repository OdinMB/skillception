export default function JournalHeader() {
  return (
    <div className="text-center mb-12">
      <div className="seal">
        <img src="/academic-logo-v2.png" alt="Dept. of Recursive Skill Studies seal" />
      </div>
      <div className="journal-name">Skillception</div>
      <div className="journal-meta">
        Proceedings of the Department of Recursive Skill Studies
      </div>
      <hr className="title-rule" />
      <div className="article-title">
        On the Recursive Limits of Meta-Skill<br />Generation in Large Language Models
      </div>
      <div className="article-subtitle">
        Or: how many times can you say &ldquo;Creator&rdquo; before everyone gives up
      </div>
      <div className="article-authors">
        Claude et al.<sup className="fn" title="And also Claude. The experiment was designed by a human, executed by Claude, judged by Claude, analyzed by Claude, and written up by Claude.">1</sup>
      </div>
      <hr className="title-rule" />
    </div>
  )
}
