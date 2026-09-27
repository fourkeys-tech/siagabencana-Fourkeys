import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth, requireRole } from "@/lib/auth/guard";
import { campValidationMessage, parseCampInput } from "@/lib/camp-validation";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        await requireAuth();

        const { id } = await params;

        const camp = await prisma.camp.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                maxCapacity: true,
                currentOccupants: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!camp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: camp,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data posko.",
            },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        await requireRole("SUPER_ADMIN");

        const { id } = await params;
        const body = await request.json();

        const existingCamp = await prisma.camp.findUnique({
            where: { id },
        });

        if (!existingCamp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko tidak ditemukan.",
                },
                { status: 404 },
            );
        }

		let campInput;
		try {
			campInput = parseCampInput({
				name: body.name ?? existingCamp.name,
				address: body.address ?? existingCamp.address,
				latitude: body.latitude ?? existingCamp.latitude,
				longitude: body.longitude ?? existingCamp.longitude,
				maxCapacity: body.maxCapacity ?? existingCamp.maxCapacity,
				status: body.status ?? existingCamp.status,
			}, existingCamp.currentOccupants);
		} catch (validationError) {
			return NextResponse.json({ success: false, message: campValidationMessage(validationError) ?? "Data posko tidak valid." }, { status: 400 });
		}

		const camp = await prisma.camp.update({
			where: { id },
			data: campInput,
		});

        return NextResponse.json({
            success: true,
            message: "Posko berhasil diperbarui.",
            data: camp,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(
                error,
                "Hanya Super Admin yang dapat mengubah posko.",
            );
        }

        console.error("UPDATE_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memperbarui posko.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        await requireRole("SUPER_ADMIN");

        const { id } = await params;

        const existingCamp = await prisma.camp.findUnique({
            where: { id },
        });

        if (!existingCamp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        await prisma.camp.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Posko berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(
                error,
                "Hanya Super Admin yang dapat menghapus posko.",
            );
        }

        console.error("DELETE_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal menghapus posko.",
            },
            { status: 500 },
        );
    }
}