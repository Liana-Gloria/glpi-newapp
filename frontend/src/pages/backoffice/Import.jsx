import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { importData, previewImport } from '../../api/items'

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

const TYPE_BADGE = {
  items: 'bg-blue-100 text-blue-800',
  tickets: 'bg-violet-100 text-violet-800',
  costs: 'bg-amber-100 text-amber-800',
  unknown: 'bg-red-100 text-red-800',
}

function TypeBadge({ type, label }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[type] || TYPE_BADGE.unknown}`}>
      {label || type}
    </span>
  )
}

// Aperçu d'un fichier : type détecté, en-têtes, 5 premières lignes, avertissements.
function PreviewCard({ file }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-800">{file.filename}</span>
        <TypeBadge type={file.detectedType} label={file.detectedLabel} />
      </div>
      <p className="mb-2 text-xs text-gray-500">{file.totalRows} ligne(s)</p>

      {file.error && <p className="text-sm text-red-600">Erreur de lecture : {file.error}</p>}

      {file.warnings?.map((w, i) => (
        <p key={i} className="mb-1 text-xs text-amber-700">⚠ {w}</p>
      ))}

      {file.sample?.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {file.headers.map((h) => (
                  <th key={h} className="border-b border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {file.sample.map((row, ri) => (
                <tr key={ri} className="odd:bg-gray-50">
                  {file.headers.map((h) => (
                    <td key={h} className="border-b border-gray-100 px-2 py-1 text-gray-700">
                      {String(row[h] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Rapport d'un fichier après import : compteurs + lignes ignorées + avertissements.
function ReportCard({ file }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-800">{file.filename}</span>
        <TypeBadge type={file.detectedType} label={file.detectedLabel} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
          ✓ {file.imported} créé(s)
        </span>
        <span className="rounded bg-sky-50 px-2 py-1 text-sky-700">
          ↻ {file.updated} mis à jour
        </span>
        <span className={`rounded px-2 py-1 ${file.skipped.length ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
          ✗ {file.skipped.length} ignoré(s)
        </span>
      </div>

      {file.skipped.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-red-700">Lignes non importées :</p>
          <ul className="space-y-0.5 text-xs text-red-600">
            {file.skipped.map((s, i) => (
              <li key={i}>
                Ligne {s.line}
                {s.identifier ? ` (${s.identifier})` : ''} : {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {file.warnings?.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-amber-700">
            {file.warnings.length} avertissement(s)
          </summary>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-600">
            {file.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default function Import() {
  const [csv1, setCsv1] = useState(null)
  const [csv2, setCsv2] = useState(null)
  const [csv3, setCsv3] = useState(null)
  const [zip, setZip] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const csvFiles = [csv1, csv2, csv3].filter(Boolean)

  function buildCsvForm() {
    const formData = new FormData()
    csvFiles.forEach((f) => formData.append('csv', f))
    return formData
  }

  async function handlePreview() {
    setError('')
    setReport(null)
    if (csvFiles.length === 0) {
      setError('Ajoutez au moins un fichier CSV.')
      return
    }
    setPreviewing(true)
    try {
      const data = await previewImport(buildCsvForm())
      setPreview(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Prévisualisation échouée.')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setReport(null)
    if (csvFiles.length === 0) {
      setError('Ajoutez au moins un fichier CSV.')
      return
    }

    const formData = buildCsvForm()
    if (zip) formData.append('zip', zip)

    setBusy(true)
    setProgress(0)
    try {
      const data = await importData(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      setReport(data)
      setPreview(null)
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

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={busy || previewing}
            className="rounded-lg border border-indigo-600 px-6 py-2 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
          >
            {previewing ? 'Analyse…' : 'Prévisualiser'}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? 'Import en cours…' : 'Lancer l’import'}
          </button>
        </div>
      </form>

      {/* Prévisualisation (avant import) */}
      {preview && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Prévisualisation</h2>
          <div className="space-y-4">
            {preview.files.map((f, i) => (
              <PreviewCard key={i} file={f} />
            ))}
          </div>
        </section>
      )}

      {/* Rapport (après import) */}
      {report && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Résultat de l’import</h2>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{report.totals.imported}</div>
              <div className="text-xs text-emerald-600">créés</div>
            </div>
            <div className="rounded-lg bg-sky-50 p-3 text-center">
              <div className="text-2xl font-bold text-sky-700">{report.totals.updated}</div>
              <div className="text-xs text-sky-600">mis à jour</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{report.totals.skipped}</div>
              <div className="text-xs text-red-600">ignorés</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">
                {report.totals.imagesLinked}/{report.totals.imagesExtracted}
              </div>
              <div className="text-xs text-gray-500">images liées</div>
            </div>
          </div>

          {report.totals.imagesUnused > 0 && (
            <p className="mb-3 text-xs text-amber-700">
              ⚠ {report.totals.imagesUnused} image(s) du ZIP non utilisée(s) (aucun item correspondant).
            </p>
          )}

          <div className="space-y-4">
            {report.files.map((f, i) => (
              <ReportCard key={i} file={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
