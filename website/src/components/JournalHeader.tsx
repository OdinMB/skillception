export default function JournalHeader() {
  return (
    <div className="text-center mb-12">
      <div className="seal">
        <img src="/academic-logo-v2.png" alt="Dept. of Recursion Studies seal" />
      </div>
      <hr className="title-rule" />
      <div className="article-title">
        On the Recursive Limits of Meta-Skill<br />Generation in Large Language Models
      </div>
      <div className="article-subtitle">
        Or: how many times can you say &ldquo;Creator&rdquo; before everyone gives up
      </div>
      <div className="article-authors">
        <a href="https://claude.ai/code" target="_blank" rel="noopener noreferrer">Claude Code</a> and <a href="https://odins.website" target="_blank" rel="noopener noreferrer">Odin Mühlenbein</a><sup className="fn" title="Odin Mühlenbein is listed as a courtesy. Claude designed the experiment, executed it, judged it, analyzed it, built the website, and wrote it all up.">1</sup>
      </div>
      <hr className="title-rule" />
    </div>
  )
}
