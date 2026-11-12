import SetupStatus from './SetupStatus'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        role="alert"
        className="bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950"
      >
        Demo, not official guidance. The storm and barangay are fictional.
      </div>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Babala</h1>
        <p className="mt-2 text-slate-700">
          Checked typhoon alerts that still work when the signal drops.
        </p>
        <SetupStatus />
      </main>
    </div>
  )
}
