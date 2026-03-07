import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const role = session.user?.role;

    if (role === "farmer") {
        redirect("/dashboard/farmer");
    } else if (role === "mandi_owner") {
        redirect("/dashboard/mandi");
    } else if (role === "transporter") {
        redirect("/dashboard/transporter");
    }

    // Fallback if role is missing or invalid
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600">Error: Invalid Role</h1>
                <p className="text-slate-600 mt-2">Cannot determine your user role.</p>
            </div>
        </div>
    );
}
