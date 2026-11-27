/**
 * Product texts pasted from Notion, ChatGPT or a website often carry Markdown: "\## Title", "\*\*bold\*\*",
 * a "\" at the end of every line, "\- item". The shop shows plain text, so those marks looked like garbage.
 * Turns such text into clean paragraphs and bullet lines. Plain text passes through unchanged.
 */
export function cleanMarkdown(input: string | null | undefined): string {
  if (!input) return ""
  return (
    input
      .replace(/\r\n?/g, "\n")
      // A backslash at the end of a line is a Markdown line break: drop it (a line with only "\" is a blank line).
      .replace(/\\[ \t]*$/gm, "")
      // Headings: "## Title" → "Title".
      .replace(/^[ \t]*\\?#{1,6}[ \t]*/gm, "")
      // Escaped punctuation: "\*" → "*", "\-" → "-", "\." → ".".
      .replace(/\\([\\`*_{}[\]()#+\-.!|>~<"'])/g, "$1")
      // Bold / italic markers around words.
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
      // List items: "- item" / "* item" → "• item".
      .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
      // Lines that were only a lone "**" or "*" after cleaning, and runs of blank lines.
      .replace(/^[ \t]*\*{1,2}[ \t]*$/gm, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}
