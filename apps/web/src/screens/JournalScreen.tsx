import { useT } from '@/i18n/useT'
import { BookOpen, Save } from 'lucide-react'
import { useState, useEffect } from 'react'

export function JournalScreen() {
  const t = useT()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [currentEntry, setCurrentEntry] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pockiva-journal')
    if (saved) {
      try {
        setEntries(JSON.parse(saved))
      } catch {
        setEntries([])
      }
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('pockiva-journal', JSON.stringify(entries))
  }, [entries])

  const handleSave = () => {
    if (!currentEntry.trim()) return
    
    if (isEditing && editId) {
      setEntries(prev => prev.map(e => e.id === editId ? { ...e, content: currentEntry, updatedAt: Date.now() } : e))
      setIsEditing(false)
      setEditId(null)
    } else {
      const newEntry: JournalEntry = {
        id: crypto.randomUUID(),
        content: currentEntry,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setEntries(prev => [newEntry, ...prev])
    }
    setCurrentEntry('')
  }

  const handleEdit = (entry: JournalEntry) => {
    setCurrentEntry(entry.content)
    setIsEditing(true)
    setEditId(entry.id)
  }

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="screen-page journal-screen" data-testid="journal-screen">
      <header className="screen-heading">
        <h1>{t.journal.title}</h1>
        <div className="header-actions">
          {isEditing && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setIsEditing(false); setEditId(null); setCurrentEntry(''); }}>
              Cancel
            </button>
          )}
        </div>
      </header>

      <section className="screen-content">
        <div className="journal-editor">
          <textarea
            value={currentEntry}
            onChange={e => setCurrentEntry(e.target.value)}
            placeholder={t.journal.placeholder}
            rows={4}
            className="journal-textarea"
          />
          <div className="editor-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={!currentEntry.trim()}>
              <Save size={16} /> {isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>

        <div className="journal-entries">
          {entries.length === 0 && (
            <div className="empty-state">
              <BookOpen size={48} className="empty-icon" />
              <p>{t.journal.placeholder}</p>
            </div>
          )}
          {entries.map(entry => (
            <article key={entry.id} className="journal-entry">
              <div className="entry-content">{entry.content}</div>
              <div className="entry-meta">
                <time>{new Date(entry.createdAt).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</time>
                <div className="entry-actions">
                  <button className="icon-button" onClick={() => handleEdit(entry)} aria-label="Edit">
                    <span className="material-icons">edit</span>
                  </button>
                  <button className="icon-button" onClick={() => handleDelete(entry.id)} aria-label="Delete">
                    <span className="material-icons">delete</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

interface JournalEntry {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}