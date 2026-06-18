const { useEffect, useState } = React;

function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [forecast] = useState({
    month1: 180,
    month3: 740,
    month6: 2100,
  });
  const [series] = useState({ books: 10, status: "dependency graph active" });

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(() => setRuns([{ stage: "healthy", timestamp: new Date().toISOString() }]))
      .catch(() => setRuns([{ stage: "offline", timestamp: new Date().toISOString() }]));
  }, []);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">ChemBook Publishing Dashboard</h1>
      <section className="grid md:grid-cols-2 gap-4">
        <article className="card">
          <h2 className="font-semibold text-lg">Pipeline Tracker</h2>
          <ul className="mt-2 text-sm">
            {runs.map((r, i) => <li key={i}>{r.stage} — {r.timestamp}</li>)}
          </ul>
        </article>
        <article className="card">
          <h2 className="font-semibold text-lg">Revenue Forecast</h2>
          <p className="text-sm mt-2">Month 1: ${forecast.month1}</p>
          <p className="text-sm">Month 3: ${forecast.month3}</p>
          <p className="text-sm">Month 6: ${forecast.month6}</p>
        </article>
      </section>
      <section className="grid md:grid-cols-2 gap-4">
        <article className="card">
          <h2 className="font-semibold text-lg">KDP Metadata Manager</h2>
          <p className="text-sm mt-2">Manage title, subtitle, description, and BISAC-ready keywords.</p>
        </article>
        <article className="card">
          <h2 className="font-semibold text-lg">SEO Keyword Tracker</h2>
          <ul className="list-disc ml-5 mt-2 text-sm">
            <li>analytical chemistry textbook</li>
            <li>instrumental analysis practice problems</li>
            <li>titration and spectroscopy explained</li>
          </ul>
        </article>
      </section>
      <section className="grid md:grid-cols-2 gap-4">
        <article className="card">
          <h2 className="font-semibold text-lg">10-Book Series Planner</h2>
          <p className="text-sm mt-2">Series size: {series.books} books</p>
          <p className="text-sm">Status: {series.status}</p>
        </article>
        <article className="card">
          <h2 className="font-semibold text-lg">Institutional Bulk Sales</h2>
          <p className="text-sm mt-2">Starter, Campus, and Consortium pricing tiers auto-generated.</p>
        </article>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Dashboard />);
