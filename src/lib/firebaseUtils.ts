import { database } from "@/lib/firebase";
import { ref, set, push, serverTimestamp } from "firebase/database";

export async function broadcastBid(harvestId: string, bidData: any) {
    try {
        const bidsRef = ref(database, `bids/${harvestId}`);
        const newBidRef = push(bidsRef);

        await set(newBidRef, {
            ...bidData,
            timestamp: serverTimestamp()
        });

        // Also update the "latestBid" for the harvest for quick fetching
        const latestBidRef = ref(database, `latestBids/${harvestId}`);
        await set(latestBidRef, {
            ...bidData,
            timestamp: serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error("Firebase broadcast error:", error);
        return false;
    }
}
