import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { importData } from '../../api/items'

function FileZone({ label, accept, file, onChange }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 text-center transition-colors hover:border-indigo-400">
      <span className="mb-2 text-sm font-medium text-gray-700">{label}</span>
      <span className="text-xs text-gray-400">
        {file ? file.name : `Cliquez pour choisir un fichier ${accept}`}
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
    </label>
  )
}

export default function Import() {
  const [csv1, setCsv1] = useState(null)
  const [csv2, setCsv2] = useState(null)
  const [csv3, setCsv3] = useState(null)
  const [zip, setZip] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const csvFiles = [csv1, csv2, csv3].filter(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    if (csvFiles.length === 0) {
      setError('Ajoutez au moins un fichier CSV.')
      return
    }

    const formData = new FormData()
    csvFiles.forEach((f) => formData.append('csv', f))
    if (zip) formData.append('zip', zip)

    setBusy(true)
    setProgress(0)
    try {
      const data = await importData(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
    } catch (err) {
      setError(err.response?.data?.error || 'Import échoué.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Import des données</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FileZone label="CSV n°1" accept=".csv" file={csv1} onChange={setCsv1} />
          <FileZone label="CSV n°2" accept=".csv" file={csv2} onChange={setCsv2} />
          <FileZone label="CSV n°3" accept=".csv" file={csv3} onChange={setCsv3} />
          <FileZone label="Images (ZIP)" accept=".zip" file={zip} onChange={setZip} />
        </div>

        {busy && (
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            Import réussi : <strong>{result.items}</strong> items importés depuis{' '}
            <strong>{result.files}</strong> fichier(s).
            {result.errors?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-700">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Import en cours…' : 'Lancer l’import'}
        </button>
      </form>
    </div>
  )
}
