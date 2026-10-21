'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Generation {
  id: string
  user_id: string
  image_url: string
  caption: string | null
  created_at: string
}

export default function AdminMediaPage() {
  const supabase = createClient()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [editingGen, setEditingGen] = useState<Generation | null>(null)

  // Form states
  const [newCaption, setNewCaption] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editCaption, setEditCaption] = useState('')

  const fetchGenerations = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('generations')
      .select('id, user_id, image_url, caption, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) setGenerations(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchGenerations()
  }, [])

  // CREATE
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return alert('Please select an image file.')

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileExt = selectedFile.name.split('.').pop()
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('generations')
      .upload(filePath, selectedFile)

    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('generations')
      .getPublicUrl(filePath)

    // 2. Insert row into public.generations
    const { error: insertError } = await supabase.from('generations').insert({
      user_id: user.id,
      image_url: publicUrlData.publicUrl,
      caption: newCaption.trim() || null,
    })

    setUploading(false)
    if (insertError) {
      alert(`Insert failed: ${insertError.message}`)
      return
    }

    setNewCaption('')
    setSelectedFile(null)
    fetchGenerations()
  }

  // UPDATE
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGen) return

    const { error } = await supabase
      .from('generations')
      .update({ caption: editCaption.trim() || null })
      .eq('id', editingGen.id)

    if (error) {
      alert(`Update failed: ${error.message}`)
    } else {
      setEditingGen(null)
      fetchGenerations()
    }
  }

  // DELETE
  const handleDelete = async (gen: Generation) => {
    if (!confirm('Are you sure you want to delete this media item?')) return

    // Extract storage filename if stored in 'generations' bucket
    try {
      const url = new URL(gen.image_url)
      const pathParts = url.pathname.split('/generations/')
      if (pathParts[1]) {
        await supabase.storage.from('generations').remove([decodeURIComponent(pathParts[1])])
      }
    } catch {
      // Ignore URL parse errors if external link
    }

    const { error } = await supabase.from('generations').delete().eq('id', gen.id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
    } else {
      fetchGenerations()
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-black text-[var(--color-ink)]">
          AI Media Management
        </h1>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          Full CREATE, READ, UPDATE, and DELETE operations on AI-generated assets.
        </p>
      </div>

      {/* CREATE FORM */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 font-display text-lg font-bold text-[var(--color-ink)]">
          ➕ Create New AI Media
        </h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold uppercase text-[var(--color-muted)]">
              Caption
            </label>
            <input
              type="text"
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Enter caption or prompt..."
              className="w-full rounded-xl border-2 border-[var(--color-ink)] px-3 py-2 text-sm font-medium"
            />
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold uppercase text-[var(--color-muted)]">
              Image File
            </label>
            <div className="flex items-center gap-3">
              {/* Hidden file input */}
              <input
                type="file"
                id="media-image-upload"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              {/* Custom button label matching the theme */}
              <label
                htmlFor="media-image-upload"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-surface)] px-4 py-2 font-display text-xs font-extrabold uppercase text-[var(--color-ink)] shadow-xs transition-all hover:bg-gray-100 active:translate-y-0.5"
              >
                <span>📁</span>
                <span>{selectedFile ? 'Change File' : 'Choose File'}</span>
              </label>

              {/* Selected filename string */}
              <span className="truncate text-xs font-bold text-[var(--color-ink)] max-w-[180px]">
                {selectedFile ? selectedFile.name : 'No file chosen'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-skip)] px-5 py-2.5 font-bold text-[var(--color-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Create Asset'}
          </button>
        </div>
      </form>

      {/* UPDATE MODAL / EDIT FORM */}
      {editingGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-md rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6 shadow-xl"
          >
            <h3 className="mb-4 font-display text-xl font-bold text-[var(--color-ink)]">
              Edit Caption
            </h3>
            <input
              type="text"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="mb-4 w-full rounded-xl border-2 border-[var(--color-ink)] px-3 py-2 text-sm font-medium"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingGen(null)}
                className="rounded-lg border-2 border-[var(--color-ink)] px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* READ & DELETE GRID */}
      {loading ? (
        <p className="text-sm font-bold text-[var(--color-muted)]">Loading media assets...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {generations.map((gen) => (
            <div
              key={gen.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border-[3px] border-[var(--color-ink)] bg-white shadow-sm"
            >
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gen.image_url} alt="" className="h-48 w-full object-cover" />
                <div className="p-4">
                  <p className="font-bold text-[var(--color-ink)]">
                    {gen.caption || <span className="italic text-gray-400">No caption</span>}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-[var(--color-muted)]">
                    {new Date(gen.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex border-t-2 border-[var(--color-ink)] bg-[var(--color-surface)] p-2 gap-2">
                <button
                  onClick={() => {
                    setEditingGen(gen)
                    setEditCaption(gen.caption || '')
                  }}
                  className="flex-1 rounded-lg border-2 border-[var(--color-ink)] bg-white py-1 text-xs font-bold text-[var(--color-ink)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(gen)}
                  className="flex-1 rounded-lg border-2 border-[var(--color-ink)] bg-rose-100 py-1 text-xs font-bold text-rose-700 hover:bg-rose-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}