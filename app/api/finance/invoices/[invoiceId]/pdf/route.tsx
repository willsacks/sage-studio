import { NextRequest, NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700 },
  muted: { color: "#666666" },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#333333", fontWeight: 700 },
  descCol: { flex: 3 },
  numCol: { flex: 1, textAlign: "right" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 24, paddingVertical: 2 },
  totalLabel: { width: 100, textAlign: "right" },
  totalValue: { width: 80, textAlign: "right" },
});

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// Generated on demand rather than pre-rendered and stored at send time —
// always reflects the invoice's current data, and avoids standing up a
// Supabase Storage bucket just for this. Route Handler (not a Server
// Action) since the response is a binary PDF buffer, not JSON.
export async function GET(request: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    await requireFinanceEntityRole(supabase, invoice.entity_id, user.id, "viewer");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: lineItemRows } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("display_order", { ascending: true });
  const lineItems = lineItemRows ?? [];

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice {invoice.invoice_number}</Text>
            <Text style={styles.muted}>Issued {invoice.issue_date}{invoice.due_date ? ` · Due ${invoice.due_date}` : ""}</Text>
          </View>
          <View>
            <Text>{invoice.client_name}</Text>
            {invoice.client_email && <Text style={styles.muted}>{invoice.client_email}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.descCol}>Description</Text>
            <Text style={styles.numCol}>Qty</Text>
            <Text style={styles.numCol}>Rate</Text>
            <Text style={styles.numCol}>Amount</Text>
          </View>
          {lineItems.map((li, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.descCol}>{li.description}</Text>
              <Text style={styles.numCol}>{li.quantity}</Text>
              <Text style={styles.numCol}>{money(li.unit_price)}</Text>
              <Text style={styles.numCol}>{money(li.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{money(invoice.subtotal)}</Text>
        </View>
        {invoice.tax_amount > 0 && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{money(invoice.tax_amount)}</Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalLabel, { fontWeight: 700 }]}>Total</Text>
          <Text style={[styles.totalValue, { fontWeight: 700 }]}>{money(invoice.total)}</Text>
        </View>

        {invoice.notes && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.muted}>{invoice.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
