export function SiteUnpublishedMessage({ siteName }: { siteName: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          {siteName}
        </h1>
        <p style={{ color: "#6b7280" }}>This site is not published.</p>
      </div>
    </div>
  );
}
