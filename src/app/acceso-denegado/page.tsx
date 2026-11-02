export default async function AccesoDenegado({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-archivo), sans-serif",
        background: "#15171a",
        color: "#e8e8e8",
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Acceso restringido</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#b5b5b5", marginBottom: 8 }}>
          El generador de fichas técnicas es solo para el personal de SELEC. Ingresa con tu cuenta
          corporativa de Microsoft 365.
        </p>
        {motivo ? (
          <p style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 20 }}>Detalle: {motivo}</p>
        ) : null}
        <a
          href="/api/auth/login"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "#f5a800",
            color: "#111",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Ingresar con Microsoft
        </a>
      </div>
    </main>
  );
}