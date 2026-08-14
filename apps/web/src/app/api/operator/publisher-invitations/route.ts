export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    { message: "Publisher invitations are issued only by accepting a pending Publisher Application." },
    { status: 410 },
  );
}
