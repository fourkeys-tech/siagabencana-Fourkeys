import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { canManageRequest } from "@/lib/distribution";

type Params = { params: Promise<{ id: string }> };
type ReceiptProofRow = {
    receiptProofData: string | null;
    receiptProofName: string | null;
    receiptProofMimeType: string | null;
};

const RECEIPT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
    if (mimeType === "image/jpeg") {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === "image/png") {
        return bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
            && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    return bytes.length >= 12
        && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function safeFileName(name: string | null) {
    const value = (name || "bukti-penerimaan").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
    return value || "bukti-penerimaan";
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const distribution = await prisma.distribution.findUnique({
            where: { id },
            select: { sourceCampId: true, destinationCampId: true },
        });

        if (!distribution) {
            return NextResponse.json(
                { success: false, message: "Distribusi tidak ditemukan." },
                { status: 404 },
            );
        }

        if (!canManageRequest(user, distribution.sourceCampId, distribution.destinationCampId)) {
            return NextResponse.json(
                { success: false, message: "Tidak memiliki akses ke bukti distribusi ini." },
                { status: 403 },
            );
        }

        const rows = await prisma.$queryRaw<ReceiptProofRow[]>`
            SELECT "receiptProofData", "receiptProofName", "receiptProofMimeType"
            FROM "Distribution"
            WHERE "id" = ${id}
        `;
        const proof = rows[0];
        if (!proof?.receiptProofData) {
            return NextResponse.json(
                { success: false, message: "Bukti penerimaan belum tersedia." },
                { status: 404 },
            );
        }

        const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(proof.receiptProofData);
        const mimeType = proof.receiptProofMimeType ?? match?.[1];
        if (!match || !mimeType || !RECEIPT_PROOF_TYPES.has(mimeType)) {
            return NextResponse.json(
                { success: false, message: "Bukti penerimaan tidak valid." },
                { status: 422 },
            );
        }

        const bytes = Buffer.from(match[2].replace(/[\r\n]/g, ""), "base64");
        if (bytes.length === 0 || !hasValidImageSignature(bytes, mimeType)) {
            return NextResponse.json(
                { success: false, message: "Bukti penerimaan tidak valid." },
                { status: 422 },
            );
        }
        const responseBody = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(responseBody).set(bytes);

        return new NextResponse(responseBody, {
            headers: {
                "Content-Type": mimeType,
                "Content-Length": String(bytes.length),
                "Content-Disposition": `inline; filename="${safeFileName(proof.receiptProofName)}"`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        if (isAuthError(error)) return authError(error);
        console.error("GET_DISTRIBUTION_PROOF_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil bukti penerimaan." },
            { status: 500 },
        );
    }
}
