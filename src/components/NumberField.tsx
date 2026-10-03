import { useState } from 'react'

/** Saves on blur or Enter. Give it key={value} so it refreshes when the value changes elsewhere. */
export default function NumberField({
  value, onSave, label, suffix, className = '',
}: { value: number | null; onSave: (n: number) => void; label: string; suffix?: string; className?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const commit = () => {
    const n = text.trim() === '' ? 0 : Number(text)
    if (!Number.isFinite(n) || n < 0) {
      setText(value == null ? '' : String(value))
      return
    }
    if (n !== (value ?? 0)) onSave(n)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal"
        aria-label={label}
        placeholder="0"
        className={`w-20 rounded-xl border border-line bg-paper px-3 py-2 text-center ${className}`}
      />
      {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
    </span>
  )
}
