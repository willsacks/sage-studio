import Link from "next/link";

export default function GuildSuccessPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0E0C09; }
      `}</style>
      <main style={{
        backgroundColor: "#0E0C09", color: "#F5F0E8", minHeight: "100vh",
        fontFamily: `"Cormorant Garamond", serif`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "3rem 1.5rem", textAlign: "center",
      }}>
        <div style={{ fontSize: "2.5rem", color: "#C9A84C", marginBottom: "2rem" }}>✦</div>
        <h1 style={{
          fontFamily: `"Playfair Display", serif`,
          fontSize: "clamp(2rem,6vw,3.75rem)",
          fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1,
          marginBottom: "1.5rem",
        }}>
          Welcome to The Guild.
        </h1>
        <p style={{ fontSize: "clamp(1rem,2.5vw,1.2rem)", color: "#8A8070", maxWidth: 480, lineHeight: 1.8, marginBottom: "3rem" }}>
          Your spot is secured. Check your email — we&apos;ve sent you a magic link to set up your account and access the community.
        </p>
        <Link
          href="https://creatorscircle.art"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.875rem 2.25rem",
            backgroundColor: "#C9A84C", color: "#0E0C09",
            border: "none", borderRadius: "2px",
            fontFamily: `"Playfair Display", serif`, fontSize: "0.8rem",
            fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Go to Creator Circle →
        </Link>
        <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "rgba(138,128,112,0.6)" }}>
          Didn&apos;t get the email? Check your spam folder or{" "}
          <a href="mailto:will@fulcrumventures.org" style={{ color: "#C9A84C", textDecoration: "none" }}>
            contact Will
          </a>.
        </p>
      </main>
    </>
  );
}
